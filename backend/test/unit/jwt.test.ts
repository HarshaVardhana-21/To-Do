import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { signToken, verifyToken } from "../../src/utils/jwt.js";
import { randomObjectId, signRaw } from "../helpers/factories.js";

describe("jwt utils", () => {
  it("round-trips a user id", () => {
    const id = randomObjectId();
    expect(verifyToken(signToken(id))).toEqual({ sub: id });
  });

  it("uses HS256 and sets an expiry from JWT_EXPIRES_IN", () => {
    const decoded = jwt.decode(signToken(randomObjectId()), { complete: true })!;
    const payload = decoded.payload as jwt.JwtPayload;
    expect(decoded.header.alg).toBe("HS256");
    expect(payload.exp! - payload.iat!).toBe(3600); // "1h" in the test env
  });

  it("rejects an expired token", () => {
    const token = signRaw({ sub: randomObjectId() }, { expiresIn: -10 });
    expect(() => verifyToken(token)).toThrow(/expired/i);
  });

  it("rejects a token signed with another secret", () => {
    const token = signRaw({ sub: randomObjectId() }, {}, "some-other-secret-some-other-secret-xx");
    expect(() => verifyToken(token)).toThrow(/signature/i);
  });

  it("rejects an unsigned (alg: none) token", () => {
    const token = jwt.sign({ sub: randomObjectId() }, "", { algorithm: "none" });
    expect(() => verifyToken(token)).toThrow();
  });

  it("rejects a tampered payload", () => {
    const [h, , s] = signToken(randomObjectId()).split(".");
    const forged = Buffer.from(JSON.stringify({ sub: randomObjectId() })).toString("base64url");
    expect(() => verifyToken(`${h}.${forged}.${s}`)).toThrow();
  });

  it("rejects tokens without a string sub", () => {
    expect(() => verifyToken(signRaw({ foo: "bar" }))).toThrow(/payload/i);
    expect(() => verifyToken(signRaw({ sub: 123 } as object))).toThrow(/payload/i);
  });

  it("rejects garbage", () => {
    expect(() => verifyToken("not-a-jwt")).toThrow();
    expect(() => verifyToken("")).toThrow();
  });
});
