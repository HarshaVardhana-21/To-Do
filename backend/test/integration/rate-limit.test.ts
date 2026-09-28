import { describe, expect, it } from "vitest";
import { api } from "../helpers/http.js";

// Runs in its own file (and therefore its own module instance) so the limiter's
// in-memory counters start from zero and can't affect other suites.
const LIMIT = 50;

describe("auth rate limiting", () => {
  it("blocks the 51st login attempt from the same IP within the window", async () => {
    const ip = { "X-Forwarded-For": "203.0.113.7" };
    const body = { email: "nobody@example.com", password: "whatever1" };

    for (let i = 0; i < LIMIT; i++) {
      const res = await api().post("/api/auth/login").set(ip).send(body);
      expect(res.status).toBe(401);
    }

    const blocked = await api().post("/api/auth/login").set(ip).send(body).expect(429);
    expect(blocked.body).toEqual({ success: false, message: "Too many attempts, please try again later" });
    expect(blocked.headers["ratelimit-policy"] ?? blocked.headers["ratelimit"]).toBeDefined();
  });

  it("shares the budget between login and register", async () => {
    const ip = { "X-Forwarded-For": "203.0.113.8" };
    for (let i = 0; i < LIMIT; i++) {
      await api().post("/api/auth/register").set(ip).send({});
    }
    await api().post("/api/auth/login").set(ip).send({}).expect(429);
  });

  it("tracks IPs independently", async () => {
    await api()
      .post("/api/auth/login")
      .set({ "X-Forwarded-For": "203.0.113.99" })
      .send({ email: "a@b.co", password: "x" })
      .expect(401);
  });

  it("does not rate-limit /api/auth/me or todo routes", async () => {
    const ip = { "X-Forwarded-For": "203.0.113.7" }; // exhausted above
    await api().get("/api/auth/me").set(ip).expect(401);
    await api().get("/api/todos").set(ip).expect(401);
  });
});
