import { describe, expect, it } from "vitest";
import { ApiError } from "../../src/utils/ApiError.js";

describe("ApiError", () => {
  it("stores status, message and details", () => {
    const err = new ApiError(418, "teapot", { a: 1 });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    expect(err.statusCode).toBe(418);
    expect(err.message).toBe("teapot");
    expect(err.details).toEqual({ a: 1 });
  });

  it.each([
    ["badRequest", 400, "Bad request"],
    ["unauthorized", 401, "Not authenticated"],
    ["notFound", 404, "Resource not found"],
    ["conflict", 409, "Conflict"],
  ] as const)("%s() defaults to %i", (factory, status, message) => {
    const err = ApiError[factory]();
    expect(err.statusCode).toBe(status);
    expect(err.message).toBe(message);
  });

  it("factories accept a custom message", () => {
    expect(ApiError.notFound("Todo not found").message).toBe("Todo not found");
    expect(ApiError.badRequest("nope", ["x"]).details).toEqual(["x"]);
  });
});
