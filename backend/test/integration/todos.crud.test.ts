import { beforeEach, describe, expect, it } from "vitest";
import { Todo } from "../../src/models/Todo.js";
import { api } from "../helpers/http.js";
import { createTodo, createUser, randomObjectId, type TestUser } from "../helpers/factories.js";

let user: TestUser;
beforeEach(async () => {
  user = await createUser();
});

const TODO_SHAPE = {
  id: expect.any(String),
  user: expect.any(String),
  title: expect.any(String),
  description: expect.any(String),
  completed: expect.any(Boolean),
  completedAt: null,
  priority: expect.stringMatching(/^(low|medium|high)$/),
  dueDate: null,
  tags: expect.any(Array),
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
};

describe("POST /api/todos", () => {
  it("creates a todo with defaults", async () => {
    const res = await api().post("/api/todos").set(user.auth).send({ title: "Buy milk" }).expect(201);
    expect(res.body).toEqual({ success: true, data: { todo: { ...TODO_SHAPE, title: "Buy milk" } } });
    expect(res.body.data.todo).toMatchObject({ user: user.id, description: "", priority: "medium", completed: false });
    expect(res.body.data.todo).not.toHaveProperty("_id");
    expect(res.body.data.todo).not.toHaveProperty("priorityRank");
    expect(await Todo.countDocuments({ user: user.id })).toBe(1);
  });

  it("creates a todo with every field", async () => {
    const res = await api()
      .post("/api/todos")
      .set(user.auth)
      .send({
        title: "  Ship release  ",
        description: "Tag and publish",
        priority: "high",
        dueDate: "2030-06-01T12:00:00.000Z",
        tags: ["Work", "work", "Release"],
      })
      .expect(201);
    expect(res.body.data.todo).toMatchObject({
      title: "Ship release",
      description: "Tag and publish",
      priority: "high",
      dueDate: "2030-06-01T12:00:00.000Z",
      tags: ["work", "release"],
    });
  });

  it("sets completedAt when created already completed", async () => {
    const res = await api().post("/api/todos").set(user.auth).send({ title: "Done", completed: true }).expect(201);
    expect(res.body.data.todo.completed).toBe(true);
    expect(new Date(res.body.data.todo.completedAt).getTime()).toBeCloseTo(Date.now(), -4);
  });

  it("always assigns the todo to the authenticated user (ignores body.user)", async () => {
    const other = await createUser();
    const res = await api().post("/api/todos").set(user.auth).send({ title: "Mine", user: other.id }).expect(201);
    expect(res.body.data.todo.user).toBe(user.id);
    expect(await Todo.countDocuments({ user: other.id })).toBe(0);
  });

  it("stores HTML/script content verbatim (no server-side execution) and returns it as JSON", async () => {
    const title = `<script>alert("x")</script>`;
    const res = await api().post("/api/todos").set(user.auth).send({ title }).expect(201);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.data.todo.title).toBe(title);
  });

  it("accepts unicode", async () => {
    const res = await api().post("/api/todos").set(user.auth).send({ title: "Café ☕ 日本語 🎉" }).expect(201);
    expect(res.body.data.todo.title).toBe("Café ☕ 日本語 🎉");
  });

  it.each([
    [{}, "title"],
    [{ title: "" }, "title"],
    [{ title: "x".repeat(201) }, "title"],
    [{ title: "T", priority: "urgent" }, "priority"],
    [{ title: "T", dueDate: "tomorrow-ish" }, "dueDate"],
    [{ title: "T", tags: "work" }, "tags"],
    [{ title: "T", completed: "true" }, "completed"],
  ])("rejects %j", async (body, field) => {
    const res = await api().post("/api/todos").set(user.auth).send(body).expect(400);
    expect(res.body.details.map((d: { path: string }) => d.path)).toContain(field);
    expect(await Todo.countDocuments()).toBe(0);
  });
});

describe("GET /api/todos/:id", () => {
  it("returns the todo", async () => {
    const t = await createTodo(user.id, { title: "Read book" });
    const res = await api().get(`/api/todos/${t.id}`).set(user.auth).expect(200);
    expect(res.body.data.todo).toMatchObject({ id: t.id, title: "Read book" });
  });

  it("404s for a non-existent id", async () => {
    const res = await api().get(`/api/todos/${randomObjectId()}`).set(user.auth).expect(404);
    expect(res.body).toEqual({ success: false, message: "Todo not found" });
  });

  it("400s for a malformed id", async () => {
    const res = await api().get("/api/todos/not-an-id").set(user.auth).expect(400);
    expect(res.body.details).toEqual([{ path: "id", message: "Invalid todo id" }]);
  });
});

describe("PATCH /api/todos/:id", () => {
  it("updates only the provided fields", async () => {
    const t = await createTodo(user.id, { title: "Old", description: "keep me", priority: "low" });
    const res = await api().patch(`/api/todos/${t.id}`).set(user.auth).send({ title: "New" }).expect(200);
    expect(res.body.data.todo).toMatchObject({ title: "New", description: "keep me", priority: "low" });
    const fresh = await Todo.findById(t.id);
    expect(fresh?.title).toBe("New");
  });

  it("bumps updatedAt but not createdAt", async () => {
    const t = await createTodo(user.id);
    await new Promise((r) => setTimeout(r, 10));
    const res = await api().patch(`/api/todos/${t.id}`).set(user.auth).send({ title: "Changed" }).expect(200);
    expect(res.body.data.todo.createdAt).toBe(t.createdAt.toISOString());
    expect(new Date(res.body.data.todo.updatedAt).getTime()).toBeGreaterThan(t.updatedAt.getTime());
  });

  it("sets completedAt on completion and clears it on un-completion", async () => {
    const t = await createTodo(user.id);
    const done = await api().patch(`/api/todos/${t.id}`).set(user.auth).send({ completed: true }).expect(200);
    expect(done.body.data.todo.completed).toBe(true);
    expect(done.body.data.todo.completedAt).toEqual(expect.any(String));

    const undone = await api().patch(`/api/todos/${t.id}`).set(user.auth).send({ completed: false }).expect(200);
    expect(undone.body.data.todo.completed).toBe(false);
    expect(undone.body.data.todo.completedAt).toBeNull();
  });

  it("does not reset completedAt when re-sending completed: true", async () => {
    const t = await createTodo(user.id);
    const first = await api().patch(`/api/todos/${t.id}`).set(user.auth).send({ completed: true });
    await new Promise((r) => setTimeout(r, 10));
    const second = await api().patch(`/api/todos/${t.id}`).set(user.auth).send({ completed: true, title: "x" });
    expect(second.body.data.todo.completedAt).toBe(first.body.data.todo.completedAt);
  });

  it("clears the due date with null", async () => {
    const t = await createTodo(user.id, { dueDate: new Date("2030-01-01") });
    const res = await api().patch(`/api/todos/${t.id}`).set(user.auth).send({ dueDate: null }).expect(200);
    expect(res.body.data.todo.dueDate).toBeNull();
  });

  it("replaces tags", async () => {
    const t = await createTodo(user.id, { tags: ["a", "b"] });
    const res = await api().patch(`/api/todos/${t.id}`).set(user.auth).send({ tags: ["C"] }).expect(200);
    expect(res.body.data.todo.tags).toEqual(["c"]);
  });

  it("cannot reassign ownership or overwrite system fields", async () => {
    const other = await createUser();
    const t = await createTodo(user.id);
    await api()
      .patch(`/api/todos/${t.id}`)
      .set(user.auth)
      .send({ title: "ok", user: other.id, _id: randomObjectId(), createdAt: "2000-01-01", completedAt: "2000-01-01" })
      .expect(200);
    const fresh = await Todo.findById(t.id);
    expect(fresh?.user.toString()).toBe(user.id);
    expect(fresh?.createdAt.getFullYear()).not.toBe(2000);
    expect(fresh?.completedAt).toBeNull();
  });

  it("rejects an empty update", async () => {
    const t = await createTodo(user.id);
    const res = await api().patch(`/api/todos/${t.id}`).set(user.auth).send({}).expect(400);
    expect(res.body.details[0].message).toBe("Provide at least one field to update");
  });

  it("rejects invalid values", async () => {
    const t = await createTodo(user.id);
    await api().patch(`/api/todos/${t.id}`).set(user.auth).send({ priority: "urgent" }).expect(400);
    await api().patch(`/api/todos/${t.id}`).set(user.auth).send({ title: "   " }).expect(400);
  });

  it("404s for a missing todo and 400s for a malformed id", async () => {
    await api().patch(`/api/todos/${randomObjectId()}`).set(user.auth).send({ title: "x" }).expect(404);
    await api().patch("/api/todos/xyz").set(user.auth).send({ title: "x" }).expect(400);
  });
});

describe("DELETE /api/todos/:id", () => {
  it("deletes the todo and returns its id", async () => {
    const t = await createTodo(user.id);
    const res = await api().delete(`/api/todos/${t.id}`).set(user.auth).expect(200);
    expect(res.body).toEqual({ success: true, data: { id: t.id } });
    expect(await Todo.findById(t.id)).toBeNull();
  });

  it("is not idempotent-success: a second delete 404s", async () => {
    const t = await createTodo(user.id);
    await api().delete(`/api/todos/${t.id}`).set(user.auth).expect(200);
    await api().delete(`/api/todos/${t.id}`).set(user.auth).expect(404);
  });

  it("only deletes the targeted todo", async () => {
    const [a, b] = await Promise.all([createTodo(user.id), createTodo(user.id)]);
    await api().delete(`/api/todos/${a.id}`).set(user.auth).expect(200);
    expect(await Todo.findById(b.id)).not.toBeNull();
  });
});

describe("DELETE /api/todos/completed", () => {
  it("deletes only the caller's completed todos", async () => {
    const other = await createUser();
    await Promise.all([
      createTodo(user.id, { completed: true }),
      createTodo(user.id, { completed: true }),
      createTodo(user.id, { completed: false }),
      createTodo(other.id, { completed: true }),
    ]);
    const res = await api().delete("/api/todos/completed").set(user.auth).expect(200);
    expect(res.body).toEqual({ success: true, data: { deletedCount: 2 } });
    expect(await Todo.countDocuments({ user: user.id })).toBe(1);
    expect(await Todo.countDocuments({ user: other.id, completed: true })).toBe(1);
  });

  it("returns 0 when there is nothing to clear", async () => {
    const res = await api().delete("/api/todos/completed").set(user.auth).expect(200);
    expect(res.body.data.deletedCount).toBe(0);
  });
});

describe("full lifecycle", () => {
  it("create → list → complete → stats → clear → empty", async () => {
    const created = await api().post("/api/todos").set(user.auth).send({ title: "Lifecycle" }).expect(201);
    const id = created.body.data.todo.id;

    let list = await api().get("/api/todos").set(user.auth).expect(200);
    expect(list.body.data.todos.map((t: { id: string }) => t.id)).toEqual([id]);

    await api().patch(`/api/todos/${id}`).set(user.auth).send({ completed: true }).expect(200);
    const stats = await api().get("/api/todos/stats").set(user.auth).expect(200);
    expect(stats.body.data).toEqual({ total: 1, completed: 1, active: 0, overdue: 0 });

    await api().delete("/api/todos/completed").set(user.auth).expect(200);
    list = await api().get("/api/todos").set(user.auth).expect(200);
    expect(list.body.data).toEqual({ todos: [], count: 0 });
  });
});
