import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { z, ZodError } from "zod";
import { authUserId, requireAuth } from "../../src/middleware/auth.js";
import { validate } from "../../src/middleware/validate.js";
import { errorHandler, notFound } from "../../src/middleware/errorHandler.js";
import { ApiError } from "../../src/utils/ApiError.js";
import { signToken } from "../../src/utils/jwt.js";
import { randomObjectId, signRaw } from "../helpers/factories.js";

function mockReq(partial: Partial<Request> = {}): Request {
  return { headers: {}, params: {}, query: {}, body: undefined, ...partial } as Request;
}

function mockRes() {
  const res = { statusCode: 200, body: undefined as unknown } as Response & { body: unknown };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as never;
  res.json = vi.fn((b: unknown) => {
    res.body = b;
    return res;
  }) as never;
  return res;
}

const runAuth = (authorization?: string) => {
  const req = mockReq({ headers: authorization === undefined ? {} : { authorization } });
  const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
  requireAuth(req, mockRes(), next);
  return { req, next, err: (next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as ApiError | undefined };
};

describe("requireAuth", () => {
  it("sets req.userId for a valid token", () => {
    const id = randomObjectId();
    const { req, err, next } = runAuth(`Bearer ${signToken(id)}`);
    expect(err).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe(id);
  });

  it.each([
    ["no header", undefined],
    ["empty header", ""],
    ["wrong scheme", `Basic ${Buffer.from("a:b").toString("base64")}`],
    ["lowercase scheme", `bearer ${signToken(randomObjectId())}`],
    ["empty token", "Bearer "],
    ["garbage token", "Bearer abc.def.ghi"],
    ["expired token", `Bearer ${signRaw({ sub: randomObjectId() }, { expiresIn: -1 })}`],
    ["wrong secret", `Bearer ${signRaw({ sub: randomObjectId() }, {}, "x".repeat(40))}`],
    ["non-ObjectId subject", `Bearer ${signRaw({ sub: "not-an-object-id" })}`],
  ])("rejects %s with 401", (_label, header) => {
    const { req, err } = runAuth(header);
    expect(err).toBeInstanceOf(ApiError);
    expect(err?.statusCode).toBe(401);
    expect(req.userId).toBeUndefined();
  });
});

describe("authUserId", () => {
  it("returns the id or throws 401", () => {
    expect(authUserId(mockReq({ userId: "abc" } as Partial<Request>))).toBe("abc");
    expect(() => authUserId(mockReq())).toThrow(ApiError);
  });
});

describe("validate", () => {
  const schemas = {
    params: z.object({ id: z.string().min(3) }),
    body: z.object({ n: z.coerce.number() }),
    query: z.object({ q: z.string().default("dflt") }),
  };

  it("replaces body, params and query with parsed values", () => {
    const req = mockReq({ params: { id: "abc" }, body: { n: "5", extra: 1 }, query: {} });
    const next = vi.fn();
    validate(schemas)(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ n: 5 });
    expect(req.params).toEqual({ id: "abc" });
    expect(req.query).toEqual({ q: "dflt" });
  });

  it("works when req.query is a getter-only property (Express 5)", () => {
    const req = mockReq();
    Object.defineProperty(req, "query", { get: () => ({ q: "x" }), configurable: true });
    validate({ query: schemas.query })(req, mockRes(), vi.fn());
    expect(req.query).toEqual({ q: "x" });
  });

  it("treats a missing body as an empty object", () => {
    const req = mockReq({ body: undefined });
    expect(() => validate({ body: z.object({ a: z.string() }) })(req, mockRes(), vi.fn())).toThrow(ZodError);
    const ok = mockReq({ body: undefined });
    validate({ body: z.object({ a: z.string().optional() }) })(ok, mockRes(), vi.fn());
    expect(ok.body).toEqual({});
  });

  it("throws ZodError (handled centrally) on invalid input", () => {
    const req = mockReq({ params: { id: "x" } });
    expect(() => validate({ params: schemas.params })(req, mockRes(), vi.fn())).toThrow(ZodError);
  });
});

describe("notFound", () => {
  it("forwards a 404 ApiError including method and URL", () => {
    const next = vi.fn();
    notFound(mockReq({ method: "GET", originalUrl: "/api/x" } as Partial<Request>), mockRes(), next);
    const err = next.mock.calls[0][0] as ApiError;
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain("GET /api/x");
  });
});

describe("errorHandler", () => {
  const handle = (err: unknown) => {
    const res = mockRes();
    errorHandler(err, mockReq(), res, vi.fn());
    return { status: res.statusCode, body: res.body as Record<string, unknown> };
  };

  it("maps ApiError", () => {
    expect(handle(new ApiError(409, "dupe", { f: 1 }))).toEqual({
      status: 409,
      body: { success: false, message: "dupe", details: { f: 1 } },
    });
  });

  it("maps ZodError to 400 with field details", () => {
    const r = z.object({ a: z.string() }).safeParse({});
    const { status, body } = handle(r.error);
    expect(status).toBe(400);
    expect(body.message).toBe("Validation failed");
    expect(body.details).toEqual([{ path: "a", message: expect.any(String) }]);
  });

  it("maps Mongoose ValidationError to 400", () => {
    const err = new mongoose.Error.ValidationError();
    err.addError("title", new mongoose.Error.ValidatorError({ path: "title", message: "Title bad" }));
    const { status, body } = handle(err);
    expect(status).toBe(400);
    expect(body.details).toEqual([{ path: "title", message: "Title bad" }]);
  });

  it("maps CastError to 400", () => {
    const { status, body } = handle(new mongoose.Error.CastError("ObjectId", "zzz", "_id"));
    expect(status).toBe(400);
    expect(body.message).toBe("Invalid _id");
  });

  it("maps duplicate key errors to 409", () => {
    expect(handle(Object.assign(new Error("E11000"), { code: 11000 })).status).toBe(409);
  });

  it("maps body-parser errors to their HTTP status", () => {
    expect(handle(Object.assign(new Error("bad"), { type: "entity.parse.failed", status: 400 })).status).toBe(400);
    expect(handle(Object.assign(new Error("big"), { type: "entity.too.large", status: 413, expose: true })).status).toBe(
      413,
    );
  });

  it("hides internals for unknown errors but includes a stack outside production", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = handle(new Error("db exploded"));
    expect(status).toBe(500);
    expect(body.message).toBe("Internal server error");
    expect(body.stack).toContain("db exploded");
    expect(spy).toHaveBeenCalled();
  });

  it("handles non-Error throwables", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = handle("a string");
    expect(status).toBe(500);
    expect(body).not.toHaveProperty("stack");
  });
});
