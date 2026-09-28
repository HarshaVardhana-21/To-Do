import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { User } from "../../src/models/User.js";
import { Todo, priorityRank } from "../../src/models/Todo.js";
import { createUser } from "../helpers/factories.js";

describe("User model", () => {
  it("hashes the password on create and never stores plaintext", async () => {
    const u = await createUser({ password: "supersecret1" });
    const raw = await User.collection.findOne({ email: u.email });
    expect(raw?.password).toBeDefined();
    expect(raw?.password).not.toBe("supersecret1");
    expect(await bcrypt.compare("supersecret1", raw!.password)).toBe(true);
  });

  it("does not re-hash when other fields change", async () => {
    const u = await createUser();
    const before = (await User.collection.findOne({ email: u.email }))!.password;
    const doc = (await User.findById(u.id))!;
    doc.name = "Renamed";
    await doc.save();
    const after = (await User.collection.findOne({ email: u.email }))!.password;
    expect(after).toBe(before);
  });

  it("re-hashes when the password changes", async () => {
    const u = await createUser();
    const doc = (await User.findById(u.id).select("+password"))!;
    doc.password = "brand-new-pass";
    await doc.save();
    const fresh = (await User.findById(u.id).select("+password"))!;
    expect(await fresh.comparePassword("brand-new-pass")).toBe(true);
    expect(await fresh.comparePassword(u.password)).toBe(false);
  });

  it("excludes password from queries by default", async () => {
    const u = await createUser();
    const doc = await User.findById(u.id);
    expect(doc?.password).toBeUndefined();
  });

  it("comparePassword validates correctly", async () => {
    const u = await createUser({ password: "correct-horse" });
    const doc = (await User.findById(u.id).select("+password"))!;
    expect(await doc.comparePassword("correct-horse")).toBe(true);
    expect(await doc.comparePassword("wrong-horse")).toBe(false);
  });

  it("lowercases and trims email", async () => {
    const doc = await User.create({ name: "X", email: "  MiXeD@Example.COM ", password: "password123" });
    expect(doc.email).toBe("mixed@example.com");
  });

  it("toJSON exposes id and hides _id, __v and password", async () => {
    const u = await createUser();
    const doc = (await User.findById(u.id).select("+password"))!;
    const json = doc.toJSON() as unknown as Record<string, unknown>;
    expect(json.id).toBe(u.id);
    expect(json).not.toHaveProperty("_id");
    expect(json).not.toHaveProperty("__v");
    expect(json).not.toHaveProperty("password");
    expect(json).toHaveProperty("createdAt");
  });

  it("enforces a unique email", async () => {
    await createUser({ email: "dupe@example.com" });
    await expect(User.create({ name: "Y", email: "DUPE@example.com", password: "password123" })).rejects.toMatchObject({
      code: 11000,
    });
  });

  it("requires name, email and password", async () => {
    await expect(User.create({})).rejects.toThrow(/validation failed/i);
  });
});

describe("Todo model", () => {
  it("priorityRank orders low < medium < high", () => {
    expect(priorityRank("low")).toBeLessThan(priorityRank("medium"));
    expect(priorityRank("medium")).toBeLessThan(priorityRank("high"));
  });

  it("applies defaults", async () => {
    const u = await createUser();
    const t = await Todo.create({ user: u.id, title: "Hello" });
    expect(t).toMatchObject({ description: "", completed: false, completedAt: null, priority: "medium", dueDate: null });
    expect(t.tags).toEqual([]);
  });

  it("keeps priorityRank in sync on save", async () => {
    const u = await createUser();
    const t = await Todo.create({ user: u.id, title: "Hello", priority: "high" });
    let raw = await Todo.collection.findOne({ _id: t._id });
    expect(raw?.priorityRank).toBe(priorityRank("high"));

    t.priority = "low";
    await t.save();
    raw = await Todo.collection.findOne({ _id: t._id });
    expect(raw?.priorityRank).toBe(priorityRank("low"));
  });

  it("toJSON hides internals", async () => {
    const u = await createUser();
    const json = (await Todo.create({ user: u.id, title: "Hi" })).toJSON() as Record<string, unknown>;
    expect(json).toHaveProperty("id");
    expect(json).not.toHaveProperty("_id");
    expect(json).not.toHaveProperty("__v");
    expect(json).not.toHaveProperty("priorityRank");
  });

  it("rejects an invalid priority and a missing owner", async () => {
    const u = await createUser();
    await expect(Todo.create({ user: u.id, title: "x", priority: "urgent" as never })).rejects.toThrow(/priority/);
    await expect(Todo.create({ title: "x" })).rejects.toThrow(/user/);
  });
});
