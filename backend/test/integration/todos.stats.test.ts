import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../helpers/http.js";
import { createTodo, createUser, daysFromNow, type TestUser } from "../helpers/factories.js";

let user: TestUser;
beforeEach(async () => {
  user = await createUser();
});

const stats = async (u = user) => (await api().get("/api/todos/stats").set(u.auth).expect(200)).body.data;

describe("GET /api/todos/stats", () => {
  it("returns zeros for a new user", async () => {
    expect(await stats()).toEqual({ total: 0, completed: 0, active: 0, overdue: 0 });
  });

  it("counts total, completed, active and overdue", async () => {
    await Promise.all([
      createTodo(user.id), // active, no due date
      createTodo(user.id, { dueDate: daysFromNow(3) }), // active, future
      createTodo(user.id, { dueDate: daysFromNow(-2) }), // overdue
      createTodo(user.id, { dueDate: daysFromNow(-5) }), // overdue
      createTodo(user.id, { completed: true }),
      createTodo(user.id, { completed: true, dueDate: daysFromNow(-5) }), // past due but done: NOT overdue
    ]);
    expect(await stats()).toEqual({ total: 6, completed: 2, active: 4, overdue: 2 });
  });

  it("only counts the caller's todos", async () => {
    const other = await createUser();
    await Promise.all([createTodo(other.id), createTodo(other.id, { dueDate: daysFromNow(-1) }), createTodo(user.id)]);
    expect(await stats()).toEqual({ total: 1, completed: 0, active: 1, overdue: 0 });
    expect(await stats(other)).toEqual({ total: 2, completed: 0, active: 2, overdue: 1 });
  });

  it("reflects updates", async () => {
    const t = await createTodo(user.id, { dueDate: daysFromNow(-1) });
    expect((await stats()).overdue).toBe(1);
    await api().patch(`/api/todos/${t.id}`).set(user.auth).send({ completed: true }).expect(200);
    expect(await stats()).toEqual({ total: 1, completed: 1, active: 0, overdue: 0 });
  });

  it("is routed before /:id (not treated as an id)", async () => {
    const res = await api().get("/api/todos/stats").set(user.auth).expect(200);
    expect(res.body.data).toHaveProperty("total");
  });
});
