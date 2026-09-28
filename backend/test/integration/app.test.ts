import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { api } from "../helpers/http.js";
import { createUser } from "../helpers/factories.js";

describe("GET /api/health", () => {
  it("reports ok and DB connected", async () => {
    const res = await api().get("/api/health").expect(200);
    expect(res.body).toEqual({
      success: true,
      data: { status: "ok", db: "connected", uptime: expect.any(Number) },
    });
  });

  it("reports the DB as disconnected when mongoose is down", async () => {
    const original = Object.getOwnPropertyDescriptor(mongoose.connection, "readyState");
    Object.defineProperty(mongoose.connection, "readyState", { get: () => 0, configurable: true });
    try {
      const res = await api().get("/api/health").expect(200);
      expect(res.body.data.db).toBe("disconnected");
    } finally {
      if (original) Object.defineProperty(mongoose.connection, "readyState", original);
      else delete (mongoose.connection as unknown as Record<string, unknown>).readyState;
    }
  });
});

describe("unknown routes", () => {
  it.each(["get", "post", "put", "delete"] as const)("%s returns a JSON 404", async (method) => {
    const res = await api()[method]("/api/does-not-exist").expect(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({ success: false, message: expect.stringContaining("/api/does-not-exist") });
  });

  it("PUT on a todo is not a supported method", async () => {
    const u = await createUser();
    await api().put("/api/todos/abc").set(u.auth).send({}).expect(404);
  });
});

describe("security headers (helmet)", () => {
  it("sets standard hardening headers and hides X-Powered-By", async () => {
    const res = await api().get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("CORS", () => {
  it.each(["http://localhost:5173", "http://allowed.example.com"])("allows configured origin %s", async (origin) => {
    const res = await api().get("/api/health").set("Origin", origin);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
  });

  it("does not allow other origins", async () => {
    const res = await api().get("/api/health").set("Origin", "http://evil.example.com");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers preflight requests for allowed origins", async () => {
    const res = await api()
      .options("/api/todos")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "PATCH")
      .set("Access-Control-Request-Headers", "authorization,content-type");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-methods"]).toContain("PATCH");
    expect(res.headers["access-control-allow-headers"]?.toLowerCase()).toContain("authorization");
  });
});

describe("request body handling", () => {
  it("rejects malformed JSON with 400", async () => {
    const u = await createUser();
    const res = await api()
      .post("/api/todos")
      .set(u.auth)
      .set("Content-Type", "application/json")
      .send('{"title": "oops"')
      .expect(400);
    expect(res.body).toEqual({ success: false, message: "Malformed JSON body" });
  });

  it("rejects JSON primitives (strict mode) with 400", async () => {
    const u = await createUser();
    await api().post("/api/todos").set(u.auth).set("Content-Type", "application/json").send('"just a string"').expect(400);
  });

  it("rejects bodies over 100kb with 413", async () => {
    const u = await createUser();
    const res = await api()
      .post("/api/todos")
      .set(u.auth)
      .send({ title: "big", description: "x".repeat(150_000) })
      .expect(413);
    expect(res.body.success).toBe(false);
  });

  it("treats a non-JSON content type as an empty body", async () => {
    const u = await createUser();
    const res = await api().post("/api/todos").set(u.auth).set("Content-Type", "text/plain").send("title=hi").expect(400);
    expect(res.body.details).toEqual([{ path: "title", message: expect.any(String) }]);
  });
});
