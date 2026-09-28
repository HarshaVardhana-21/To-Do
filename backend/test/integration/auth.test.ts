import { describe, expect, it } from "vitest";
import { User } from "../../src/models/User.js";
import { verifyToken } from "../../src/utils/jwt.js";
import { api, freshIp } from "../helpers/http.js";
import { createUser, randomObjectId, signRaw } from "../helpers/factories.js";

const register = (body: object) => api().post("/api/auth/register").set(freshIp()).send(body);
const login = (body: object) => api().post("/api/auth/login").set(freshIp()).send(body);

const VALID = { name: "Alice Doe", email: "alice@example.com", password: "password123" };

describe("POST /api/auth/register", () => {
  it("creates a user and returns a public profile plus a working token", async () => {
    const res = await register(VALID).expect(201);

    expect(res.body.success).toBe(true);
    const { user, token } = res.body.data;
    expect(user).toEqual({
      id: expect.any(String),
      name: "Alice Doe",
      email: "alice@example.com",
      about: "",
      avatar: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(verifyToken(token).sub).toBe(user.id);

    const me = await api().get("/api/auth/me").set("Authorization", `Bearer ${token}`).expect(200);
    expect(me.body.data.user.id).toBe(user.id);
  });

  it("never returns or stores the plaintext password", async () => {
    const res = await register(VALID).expect(201);
    expect(JSON.stringify(res.body)).not.toContain("password123");
    const raw = await User.collection.findOne({ email: VALID.email });
    expect(raw?.password).toMatch(/^\$2[aby]\$12\$/); // bcrypt, cost 12
  });

  it("normalizes email casing and whitespace", async () => {
    const res = await register({ ...VALID, email: "  Alice@Example.COM " }).expect(201);
    expect(res.body.data.user.email).toBe("alice@example.com");
  });

  it("rejects a duplicate email case-insensitively with 409", async () => {
    await register(VALID).expect(201);
    const res = await register({ ...VALID, email: "ALICE@example.com" }).expect(409);
    expect(res.body).toEqual({ success: false, message: "An account with this email already exists" });
    expect(await User.countDocuments()).toBe(1);
  });

  it("handles concurrent duplicate registrations (unique index) with exactly one success", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => register(VALID)));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    expect(await User.countDocuments({ email: VALID.email })).toBe(1);
  });

  it("returns every validation error at once", async () => {
    const res = await register({ name: "", email: "nope", password: "short" }).expect(400);
    expect(res.body.message).toBe("Validation failed");
    expect(res.body.details.map((d: { path: string }) => d.path).sort()).toEqual(["email", "name", "password"]);
  });

  it("ignores privileged/unknown fields", async () => {
    const res = await register({ ...VALID, _id: randomObjectId(), role: "admin", isAdmin: true }).expect(201);
    const raw = await User.collection.findOne({ email: VALID.email });
    expect(raw).not.toHaveProperty("role");
    expect(raw).not.toHaveProperty("isAdmin");
    expect(res.body.data.user).not.toHaveProperty("role");
  });

  it("rejects NoSQL operator payloads", async () => {
    await register({ ...VALID, email: { $gt: "" } }).expect(400);
  });

  it("rejects a missing body", async () => {
    await api().post("/api/auth/register").set(freshIp()).expect(400);
  });
});

describe("POST /api/auth/login", () => {
  it("returns the user and a token for valid credentials", async () => {
    const u = await createUser({ email: "bob@example.com", password: "hunter2hunter2" });
    const res = await login({ email: "bob@example.com", password: "hunter2hunter2" }).expect(200);
    expect(res.body.data.user).toMatchObject({ id: u.id, email: "bob@example.com" });
    expect(res.body.data.user).not.toHaveProperty("password");
    expect(verifyToken(res.body.data.token).sub).toBe(u.id);
  });

  it("is case-insensitive on email", async () => {
    await createUser({ email: "bob@example.com" });
    await login({ email: "BOB@Example.com", password: "password123" }).expect(200);
  });

  it("returns the same 401 for a wrong password and an unknown email (no user enumeration)", async () => {
    await createUser({ email: "bob@example.com" });
    const wrongPw = await login({ email: "bob@example.com", password: "wrong-password" }).expect(401);
    const unknown = await login({ email: "nobody@example.com", password: "whatever1" }).expect(401);
    expect(wrongPw.body).toEqual(unknown.body);
    expect(wrongPw.body.message).toBe("Invalid email or password");
  });

  it("rejects operator injection in credentials", async () => {
    await createUser({ email: "bob@example.com" });
    await login({ email: "bob@example.com", password: { $ne: null } }).expect(400);
    await login({ email: { $regex: ".*" }, password: "password123" }).expect(400);
  });

  it("validates input", async () => {
    const res = await login({ email: "not-an-email" }).expect(400);
    expect(res.body.details.map((d: { path: string }) => d.path).sort()).toEqual(["email", "password"]);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user", async () => {
    const u = await createUser({ name: "Carol" });
    const res = await api().get("/api/auth/me").set(u.auth).expect(200);
    expect(res.body.data.user).toMatchObject({ id: u.id, name: "Carol", email: u.email });
    expect(res.body.data.user).not.toHaveProperty("password");
  });

  it("requires a token", async () => {
    const res = await api().get("/api/auth/me").expect(401);
    expect(res.body).toEqual({ success: false, message: "Missing or malformed Authorization header" });
  });

  it("rejects an expired token", async () => {
    const u = await createUser();
    const expired = signRaw({ sub: u.id }, { expiresIn: -1 });
    const res = await api().get("/api/auth/me").set("Authorization", `Bearer ${expired}`).expect(401);
    expect(res.body.message).toBe("Invalid or expired token");
  });

  it("returns 401 when the user no longer exists", async () => {
    const u = await createUser();
    await User.deleteOne({ _id: u.id });
    const res = await api().get("/api/auth/me").set(u.auth).expect(401);
    expect(res.body.message).toBe("User no longer exists");
  });

  it("returns 401 (not 400/500) for a validly-signed token with a malformed subject", async () => {
    const token = signRaw({ sub: "not-an-object-id" });
    await api().get("/api/auth/me").set("Authorization", `Bearer ${token}`).expect(401);
  });
});

describe("PATCH /api/auth/me", () => {
  const AVATAR = `data:image/png;base64,${"A".repeat(40)}==`;
  const patch = (u: { auth: Record<string, string> } | null, body: unknown) => {
    const req = api().patch("/api/auth/me");
    if (u) req.set(u.auth);
    return req.send(body as object);
  };

  it("updates name, about and avatar and returns the public profile", async () => {
    const u = await createUser({ name: "Dan" });
    const res = await patch(u, { name: "  Dan Abramov ", about: "  I like hooks.  ", avatar: AVATAR }).expect(200);
    expect(res.body.data.user).toMatchObject({ id: u.id, name: "Dan Abramov", about: "I like hooks.", avatar: AVATAR, email: u.email });
    expect(res.body.data.user).not.toHaveProperty("password");

    const me = await api().get("/api/auth/me").set(u.auth).expect(200);
    expect(me.body.data.user).toMatchObject({ about: "I like hooks.", avatar: AVATAR });
  });

  it("supports partial updates and removing the avatar with null", async () => {
    const u = await createUser({ name: "Eve" });
    await patch(u, { avatar: AVATAR }).expect(200);
    const res = await patch(u, { avatar: null }).expect(200);
    expect(res.body.data.user).toMatchObject({ name: "Eve", about: "", avatar: null });
  });

  it("does not let the password or email be changed", async () => {
    const u = await createUser();
    await patch(u, { about: "hi", email: "evil@example.com", password: "hacked123" }).expect(200);
    const stored = await User.findById(u.id).select("+password");
    expect(stored!.email).toBe(u.email);
    expect(await stored!.comparePassword(u.password)).toBe(true);
  });

  it("validates input", async () => {
    const u = await createUser();
    await patch(u, {}).expect(400);
    await patch(u, { name: "   " }).expect(400);
    await patch(u, { about: "x".repeat(501) }).expect(400);
    await patch(u, { avatar: "https://example.com/me.png" }).expect(400);
    await patch(u, { avatar: "data:image/svg+xml;base64,PHN2Zz4=" }).expect(400);
    const res = await patch(u, { avatar: `data:image/png;base64,${"A".repeat(70_000)}` }).expect(400);
    expect(res.body.details[0].message).toBe("Profile image is too large");
  });

  it("requires a token", async () => {
    await patch(null, { about: "x" }).expect(401);
  });
});
