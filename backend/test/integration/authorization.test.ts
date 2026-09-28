import { beforeEach, describe, expect, it } from "vitest";
import { Todo } from "../../src/models/Todo.js";
import { api } from "../helpers/http.js";
import { createTodo, createUser, randomObjectId, signRaw, type TestUser } from "../helpers/factories.js";

const PROTECTED: [method: "get" | "post" | "patch" | "delete", path: string][] = [
  ["get", "/api/todos"],
  ["post", "/api/todos"],
  ["get", "/api/todos/stats"],
  ["delete", "/api/todos/completed"],
  ["get", `/api/todos/${randomObjectId()}`],
  ["patch", `/api/todos/${randomObjectId()}`],
  ["delete", `/api/todos/${randomObjectId()}`],
  ["get", "/api/auth/me"],
];

describe("authentication is required", () => {
  it.each(PROTECTED)("%s %s → 401 without a token", async (method, path) => {
    const res = await api()[method](path).send({ title: "x" });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it.each(PROTECTED)("%s %s → 401 with an invalid token", async (method, path) => {
    const res = await api()[method](path).set("Authorization", "Bearer invalid.token.value").send({ title: "x" });
    expect(res.status).toBe(401);
  });

  it.each(PROTECTED)("%s %s → 401 with a malformed-subject token", async (method, path) => {
    const token = signRaw({ sub: "definitely-not-an-objectid" });
    const res = await api()[method](path).set("Authorization", `Bearer ${token}`).send({ title: "x" });
    expect(res.status).toBe(401);
  });

  it("checks auth before validation (no info leak on bad input)", async () => {
    await api().post("/api/todos").send({}).expect(401);
    await api().get("/api/todos/not-an-id").expect(401);
  });
});

describe("users are isolated from each other", () => {
  let alice: TestUser;
  let bob: TestUser;
  let aliceTodoId: string;

  beforeEach(async () => {
    [alice, bob] = await Promise.all([createUser({ name: "Alice" }), createUser({ name: "Bob" })]);
    aliceTodoId = (await createTodo(alice.id, { title: "Alice secret", completed: true })).id;
    await createTodo(bob.id, { title: "Bob task" });
  });

  it("list only shows own todos", async () => {
    const res = await api().get("/api/todos").set(bob.auth).expect(200);
    expect(res.body.data.todos.map((t: { title: string }) => t.title)).toEqual(["Bob task"]);
  });

  it("search does not leak across users", async () => {
    const res = await api().get("/api/todos").query({ search: "secret" }).set(bob.auth).expect(200);
    expect(res.body.data.todos).toEqual([]);
  });

  it("cannot read another user's todo (404, not 403, to avoid confirming existence)", async () => {
    const res = await api().get(`/api/todos/${aliceTodoId}`).set(bob.auth).expect(404);
    expect(res.body.message).toBe("Todo not found");
  });

  it("cannot update another user's todo", async () => {
    await api().patch(`/api/todos/${aliceTodoId}`).set(bob.auth).send({ title: "pwned" }).expect(404);
    expect((await Todo.findById(aliceTodoId))?.title).toBe("Alice secret");
  });

  it("cannot delete another user's todo", async () => {
    await api().delete(`/api/todos/${aliceTodoId}`).set(bob.auth).expect(404);
    expect(await Todo.findById(aliceTodoId)).not.toBeNull();
  });

  it("clear-completed does not touch other users", async () => {
    await api().delete("/api/todos/completed").set(bob.auth).expect(200);
    expect(await Todo.findById(aliceTodoId)).not.toBeNull();
  });

  it("owner can still access their todo", async () => {
    await api().get(`/api/todos/${aliceTodoId}`).set(alice.auth).expect(200);
  });
});
