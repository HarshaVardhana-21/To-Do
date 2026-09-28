import { afterAll, afterEach, beforeAll, inject } from "vitest";
import mongoose from "mongoose";
import { applyTestEnv } from "./test-env.js";

// Must run before any src/ module is imported, because src/config/env.ts validates on import.
// Each worker gets its own database so test files can run in parallel.
const baseUri = inject("mongoUri").replace(/\/$/, "");
const dbName = `todo-test-${process.env.VITEST_POOL_ID ?? "0"}`;
applyTestEnv(`${baseUri}/${dbName}`);

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }
  // Build unique indexes (e.g. User.email) before tests rely on them.
  const { User } = await import("../../src/models/User.js");
  const { Todo } = await import("../../src/models/Todo.js");
  await Promise.all([User.init(), Todo.init()]);
});

afterEach(async () => {
  const collections = await mongoose.connection.db?.collections();
  await Promise.all((collections ?? []).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect();
});
