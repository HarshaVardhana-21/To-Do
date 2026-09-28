import { describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const backendRoot = fileURLToPath(new URL("../..", import.meta.url));
const envModule = pathToFileURL(join(backendRoot, "src/config/env.ts")).href;
const tsxCli = join(backendRoot, "node_modules/tsx/dist/cli.mjs");
// Empty cwd so dotenv can't pick up a developer's real backend/.env.
const emptyCwd = mkdtempSync(join(tmpdir(), "todo-env-"));

const VALID = {
  MONGODB_URI: "mongodb://127.0.0.1:1/x",
  JWT_SECRET: "x".repeat(32),
};

/** Imports src/config/env.ts in a fresh process with exactly the given env. */
function loadEnv(vars: Record<string, string>) {
  const script = `import(${JSON.stringify(envModule)}).then(({ env }) => console.log("ENV=" + JSON.stringify(env)));`;
  const r = spawnSync(process.execPath, [tsxCli, "--eval", script], {
    cwd: emptyCwd,
    env: { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", ...vars },
    encoding: "utf8",
    timeout: 30_000,
  });
  const line = r.stdout.split("\n").find((l) => l.startsWith("ENV="));
  return { code: r.status, stderr: r.stderr, env: line ? JSON.parse(line.slice(4)) : undefined };
}

describe("config/env", { timeout: 60_000 }, () => {
  it("applies defaults with the minimum required vars", () => {
    const { code, env } = loadEnv(VALID);
    expect(code).toBe(0);
    expect(env).toMatchObject({
      NODE_ENV: "development",
      PORT: 5000,
      JWT_EXPIRES_IN: "7d",
      CLIENT_ORIGINS: ["http://localhost:5173"],
      isProd: false,
    });
  });

  it("coerces PORT, splits CLIENT_URL and detects production", () => {
    const { env } = loadEnv({
      ...VALID,
      PORT: "8080",
      NODE_ENV: "production",
      CLIENT_URL: "https://a.com, https://b.com ,",
    });
    expect(env.PORT).toBe(8080);
    expect(env.isProd).toBe(true);
    expect(env.CLIENT_ORIGINS).toEqual(["https://a.com", "https://b.com"]);
  });

  it.each([
    ["missing MONGODB_URI", { JWT_SECRET: VALID.JWT_SECRET }, "MONGODB_URI"],
    ["missing JWT_SECRET", { MONGODB_URI: VALID.MONGODB_URI }, "JWT_SECRET"],
    ["short JWT_SECRET", { ...VALID, JWT_SECRET: "short" }, "at least 32"],
    ["invalid PORT", { ...VALID, PORT: "abc" }, "PORT"],
    ["invalid NODE_ENV", { ...VALID, NODE_ENV: "staging" }, "NODE_ENV"],
  ])("exits with code 1 on %s", (_label, vars, expected) => {
    const { code, stderr } = loadEnv(vars);
    expect(code).toBe(1);
    expect(stderr).toContain("Invalid environment configuration");
    expect(stderr).toContain(expected);
  });
});

describe("errorHandler in production", () => {
  it("never leaks stack traces", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    const { errorHandler } = await import("../../src/middleware/errorHandler.js");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    errorHandler(new Error("secret internals"), {} as never, res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0]).toEqual({ success: false, message: "Internal server error" });
  });
});
