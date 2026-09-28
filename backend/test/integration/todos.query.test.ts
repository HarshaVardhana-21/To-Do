import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../helpers/http.js";
import { createTodo, createUser, daysFromNow, type TestUser } from "../helpers/factories.js";

let user: TestUser;

const list = async (query: Record<string, string> = {}) => {
  const res = await api().get("/api/todos").query(query).set(user.auth).expect(200);
  expect(res.body.data.count).toBe(res.body.data.todos.length);
  return res.body.data.todos as { title: string; priority: string; completed: boolean; tags: string[] }[];
};
const titles = async (query: Record<string, string> = {}) => (await list(query)).map((t) => t.title);

describe("GET /api/todos: filters", () => {
  beforeEach(async () => {
    user = await createUser();
    await createTodo(user.id, { title: "Buy milk", priority: "low", tags: ["home", "shopping"] });
    await createTodo(user.id, { title: "Write report", priority: "high", tags: ["work"], description: "Quarterly numbers" });
    await createTodo(user.id, { title: "Call mom", priority: "medium", completed: true, tags: ["home"] });
    await createTodo(user.id, { title: "Fix bug (urgent)", priority: "high", completed: true, tags: ["work"] });
  });

  it("returns all todos by default", async () => {
    expect((await titles()).sort()).toEqual(["Buy milk", "Call mom", "Fix bug (urgent)", "Write report"]);
  });

  it("filters by status", async () => {
    expect((await titles({ status: "active" })).sort()).toEqual(["Buy milk", "Write report"]);
    expect((await titles({ status: "completed" })).sort()).toEqual(["Call mom", "Fix bug (urgent)"]);
    expect(await titles({ status: "all" })).toHaveLength(4);
  });

  it("filters by priority", async () => {
    expect((await titles({ priority: "high" })).sort()).toEqual(["Fix bug (urgent)", "Write report"]);
    expect(await titles({ priority: "low" })).toEqual(["Buy milk"]);
    expect(await titles({ priority: "all" })).toHaveLength(4);
  });

  it("filters by tag (case-insensitive input)", async () => {
    expect((await titles({ tag: "HOME" })).sort()).toEqual(["Buy milk", "Call mom"]);
    expect(await titles({ tag: "nope" })).toEqual([]);
  });

  it("combines filters", async () => {
    expect(await titles({ status: "active", priority: "high", tag: "work" })).toEqual(["Write report"]);
    expect(await titles({ status: "completed", priority: "low" })).toEqual([]);
  });

  describe("search", () => {
    it("matches title, case-insensitively", async () => {
      expect(await titles({ search: "MILK" })).toEqual(["Buy milk"]);
    });

    it("matches description", async () => {
      expect(await titles({ search: "quarterly" })).toEqual(["Write report"]);
    });

    it("matches tags", async () => {
      expect(await titles({ search: "shop" })).toEqual(["Buy milk"]);
    });

    it("treats regex metacharacters literally", async () => {
      expect(await titles({ search: "(urgent)" })).toEqual(["Fix bug (urgent)"]);
      expect(await titles({ search: ".*" })).toEqual([]);
      expect(await titles({ search: "[" })).toEqual([]);
    });

    it("ignores whitespace-only search", async () => {
      expect(await titles({ search: "   " })).toHaveLength(4);
    });

    it("combines with filters", async () => {
      expect(await titles({ search: "o", status: "completed", priority: "medium" })).toEqual(["Call mom"]);
    });
  });

  it.each([{ status: "done" }, { priority: "urgent" }, { sort: "user" }, { order: "sideways" }, { search: "x".repeat(101) }])(
    "rejects invalid query %j with 400",
    async (query) => {
      await api().get("/api/todos").query(query).set(user.auth).expect(400);
    },
  );

  it("rejects repeated query params", async () => {
    await api().get("/api/todos?status=active&status=completed").set(user.auth).expect(400);
  });

  it("neutralizes operator injection through the query string", async () => {
    // Express 5's simple query parser keeps "priority[$ne]" as a literal key, which the
    // schema strips, so no Mongo operator reaches the database and no filter is applied.
    const res = await api().get("/api/todos?priority[$ne]=low").set(user.auth).expect(200);
    expect(res.body.data.todos).toHaveLength(4);
  });
});

describe("GET /api/todos: sorting", () => {
  beforeEach(async () => {
    user = await createUser();
    await createTodo(user.id, { title: "bravo", priority: "low", dueDate: daysFromNow(5), createdAt: new Date("2026-01-02") });
    await createTodo(user.id, { title: "Alpha", priority: "high", dueDate: null, createdAt: new Date("2026-01-03") });
    await createTodo(user.id, { title: "charlie", priority: "medium", dueDate: daysFromNow(1), createdAt: new Date("2026-01-01") });
    await createTodo(user.id, { title: "Delta", priority: "high", dueDate: daysFromNow(10), createdAt: new Date("2026-01-04") });
  });

  it("defaults to newest first", async () => {
    expect(await titles()).toEqual(["Delta", "Alpha", "bravo", "charlie"]);
  });

  it("sorts by createdAt ascending", async () => {
    expect(await titles({ sort: "createdAt", order: "asc" })).toEqual(["charlie", "bravo", "Alpha", "Delta"]);
  });

  it("sorts by priority semantically (high > medium > low), not alphabetically", async () => {
    const desc = (await list({ sort: "priority", order: "desc" })).map((t) => t.priority);
    expect(desc).toEqual(["high", "high", "medium", "low"]);
    const asc = (await list({ sort: "priority", order: "asc" })).map((t) => t.priority);
    expect(asc).toEqual(["low", "medium", "high", "high"]);
  });

  it("breaks priority ties by newest first", async () => {
    expect((await titles({ sort: "priority", order: "desc" })).slice(0, 2)).toEqual(["Delta", "Alpha"]);
  });

  it("sorts by due date with undated todos last in both directions", async () => {
    expect(await titles({ sort: "dueDate", order: "asc" })).toEqual(["charlie", "bravo", "Delta", "Alpha"]);
    expect(await titles({ sort: "dueDate", order: "desc" })).toEqual(["Delta", "bravo", "charlie", "Alpha"]);
  });

  it("sorts by title case-insensitively", async () => {
    expect(await titles({ sort: "title", order: "asc" })).toEqual(["Alpha", "bravo", "charlie", "Delta"]);
    expect(await titles({ sort: "title", order: "desc" })).toEqual(["Delta", "charlie", "bravo", "Alpha"]);
  });

  it("keeps priority sort correct after a priority update", async () => {
    const all = await api().get("/api/todos").set(user.auth);
    const bravo = all.body.data.todos.find((t: { title: string }) => t.title === "bravo");
    await api().patch(`/api/todos/${bravo.id}`).set(user.auth).send({ priority: "high" }).expect(200);
    const top3 = (await titles({ sort: "priority", order: "desc" })).slice(0, 3).sort();
    expect(top3).toEqual(["Alpha", "Delta", "bravo"]);
  });
});

describe("GET /api/todos: empty state", () => {
  it("returns an empty list for a new user", async () => {
    user = await createUser();
    const res = await api().get("/api/todos").set(user.auth).expect(200);
    expect(res.body).toEqual({ success: true, data: { todos: [], count: 0 } });
  });
});
