import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "../../src/validators/auth.schema.js";
import {
  createTodoSchema,
  idParamSchema,
  listTodosQuerySchema,
  updateTodoSchema,
} from "../../src/validators/todo.schema.js";
import { randomObjectId } from "../helpers/factories.js";

const paths = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.error?.issues.map((i) => i.path.join(".")) ?? [];

describe("registerSchema", () => {
  const valid = { name: "Alice", email: "alice@example.com", password: "password123" };

  it("accepts valid input and normalizes it", () => {
    const out = registerSchema.parse({ name: "  Alice  ", email: "ALICE@Example.COM", password: "password123" });
    expect(out).toEqual({ name: "Alice", email: "alice@example.com", password: "password123" });
  });

  it("trims whitespace around the email", () => {
    expect(registerSchema.parse({ ...valid, email: "  alice@example.com  " }).email).toBe("alice@example.com");
  });

  it("strips unknown fields", () => {
    const out = registerSchema.parse({ ...valid, isAdmin: true, _id: "x" });
    expect(out).not.toHaveProperty("isAdmin");
    expect(out).not.toHaveProperty("_id");
  });

  it.each([
    ["empty name", { ...valid, name: "   " }, "name"],
    ["long name", { ...valid, name: "a".repeat(61) }, "name"],
    ["bad email", { ...valid, email: "not-an-email" }, "email"],
    ["short password", { ...valid, password: "1234567" }, "password"],
    ["long password", { ...valid, password: "a".repeat(129) }, "password"],
    ["non-string email (NoSQL operator)", { ...valid, email: { $gt: "" } }, "email"],
  ])("rejects %s", (_label, input, field) => {
    const r = registerSchema.safeParse(input);
    expect(r.success).toBe(false);
    expect(paths(r)).toContain(field);
  });

  it("accepts boundary lengths", () => {
    expect(registerSchema.safeParse({ ...valid, name: "a".repeat(60), password: "a".repeat(8) }).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, password: "a".repeat(128) }).success).toBe(true);
  });

  it("reports every missing field", () => {
    expect(paths(registerSchema.safeParse({})).sort()).toEqual(["email", "name", "password"]);
  });
});

describe("loginSchema", () => {
  it("lowercases email and requires a password", () => {
    expect(loginSchema.parse({ email: "A@B.CO", password: "x" })).toEqual({ email: "a@b.co", password: "x" });
    expect(paths(loginSchema.safeParse({ email: "a@b.co", password: "" }))).toContain("password");
  });

  it("rejects operator injection in password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: { $ne: null } }).success).toBe(false);
  });
});

describe("idParamSchema", () => {
  it("accepts a valid ObjectId", () => {
    expect(idParamSchema.safeParse({ id: randomObjectId() }).success).toBe(true);
  });

  it.each(["123", "zzzzzzzzzzzzzzzzzzzzzzzz", "", "completed"])("rejects %j", (id) => {
    expect(idParamSchema.safeParse({ id }).success).toBe(false);
  });
});

describe("createTodoSchema", () => {
  it("applies defaults", () => {
    expect(createTodoSchema.parse({ title: "Task" })).toEqual({
      title: "Task",
      description: "",
      priority: "medium",
      dueDate: null,
      tags: [],
      completed: false,
    });
  });

  it("trims title/description, coerces dueDate, and normalizes + dedupes tags", () => {
    const out = createTodoSchema.parse({
      title: "  Task  ",
      description: "  details ",
      dueDate: "2030-01-01",
      tags: ["Work", "work", " HOME "],
    });
    expect(out.title).toBe("Task");
    expect(out.description).toBe("details");
    expect(out.dueDate).toEqual(new Date("2030-01-01"));
    expect(out.tags).toEqual(["work", "home"]);
  });

  it("accepts an explicit null dueDate", () => {
    expect(createTodoSchema.parse({ title: "T", dueDate: null }).dueDate).toBeNull();
  });

  it.each([
    ["missing title", {}, "title"],
    ["blank title", { title: "   " }, "title"],
    ["long title", { title: "a".repeat(201) }, "title"],
    ["long description", { title: "T", description: "a".repeat(2001) }, "description"],
    ["bad priority", { title: "T", priority: "urgent" }, "priority"],
    ["bad date", { title: "T", dueDate: "not-a-date" }, "dueDate"],
    ["too many tags", { title: "T", tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }, "tags"],
    ["long tag", { title: "T", tags: ["a".repeat(31)] }, "tags.0"],
    ["empty tag", { title: "T", tags: ["  "] }, "tags.0"],
    ["non-boolean completed", { title: "T", completed: "yes" }, "completed"],
    ["title as object", { title: { $gt: "" } }, "title"],
  ])("rejects %s", (_label, input, field) => {
    const r = createTodoSchema.safeParse(input);
    expect(r.success).toBe(false);
    expect(paths(r)).toContain(field);
  });

  it("strips owner/system fields (mass assignment)", () => {
    const out = createTodoSchema.parse({ title: "T", user: randomObjectId(), _id: "x", completedAt: new Date() });
    expect(out).not.toHaveProperty("user");
    expect(out).not.toHaveProperty("_id");
    expect(out).not.toHaveProperty("completedAt");
  });
});

describe("updateTodoSchema", () => {
  it("accepts a partial update without applying defaults", () => {
    expect(updateTodoSchema.parse({ completed: true })).toEqual({ completed: true });
  });

  it("allows clearing the due date", () => {
    expect(updateTodoSchema.parse({ dueDate: null })).toEqual({ dueDate: null });
  });

  it("rejects an empty update", () => {
    expect(updateTodoSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an update that only has unknown fields", () => {
    expect(updateTodoSchema.safeParse({ user: randomObjectId() }).success).toBe(false);
  });

  it("rejects a blank title", () => {
    expect(updateTodoSchema.safeParse({ title: " " }).success).toBe(false);
  });
});

describe("listTodosQuerySchema", () => {
  it("applies defaults", () => {
    expect(listTodosQuerySchema.parse({})).toEqual({
      status: "all",
      priority: "all",
      sort: "createdAt",
      order: "desc",
    });
  });

  it("normalizes tag and trims search", () => {
    expect(listTodosQuerySchema.parse({ tag: " WORK ", search: "  milk " })).toMatchObject({ tag: "work", search: "milk" });
  });

  it.each([
    { status: "done" },
    { priority: "urgent" },
    { sort: "user" },
    { order: "up" },
    { status: ["all", "active"] },
    { search: "a".repeat(101) },
  ])("rejects %j", (q) => {
    expect(listTodosQuerySchema.safeParse(q).success).toBe(false);
  });
});
