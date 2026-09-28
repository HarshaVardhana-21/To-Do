import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { User } from "../../src/models/User.js";
import { Todo } from "../../src/models/Todo.js";
import { signToken } from "../../src/utils/jwt.js";
import { TEST_JWT_SECRET } from "../setup/test-env.js";

let seq = 0;
const next = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export const DEFAULT_PASSWORD = "password123";

export interface TestUser {
  id: string;
  name: string;
  email: string;
  password: string;
  token: string;
  auth: { Authorization: string };
}

/** Creates a user directly in the DB (bypasses the rate-limited auth routes). */
export async function createUser(overrides: Partial<{ name: string; email: string; password: string }> = {}): Promise<TestUser> {
  const name = overrides.name ?? "Test User";
  const email = overrides.email ?? `user-${next()}@example.com`;
  const password = overrides.password ?? DEFAULT_PASSWORD;
  const user = await User.create({ name, email, password });
  const token = signToken(user.id);
  return { id: user.id, name, email, password, token, auth: { Authorization: `Bearer ${token}` } };
}

type TodoSeed = Partial<{
  title: string;
  description: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  dueDate: Date | null;
  tags: string[];
  createdAt: Date;
}>;

/** Inserts a todo for a user via the model (runs save hooks so priorityRank is set). */
export async function createTodo(userId: string, seed: TodoSeed = {}) {
  const { createdAt, ...fields } = seed;
  const todo = await Todo.create({ user: userId, title: `Todo ${next()}`, ...fields });
  if (createdAt) {
    // Timestamps would overwrite createdAt on save, so write it at the driver level.
    await Todo.collection.updateOne({ _id: todo._id }, { $set: { createdAt } });
    todo.set("createdAt", createdAt);
  }
  return todo;
}

export const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000);

export const randomObjectId = () => new Types.ObjectId().toString();

/** Signs an arbitrary token with the test secret, e.g. an expired one. */
export function signRaw(payload: object | string, options: jwt.SignOptions = {}, secret = TEST_JWT_SECRET) {
  return jwt.sign(payload, secret, options);
}
