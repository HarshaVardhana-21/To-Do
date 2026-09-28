import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const backendRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root: backendRoot,
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // Starts one in-memory MongoDB for the whole run; each worker gets its own database.
    globalSetup: ["test/setup/global-setup.ts"],
    // Sets env vars, connects Mongoose, and wipes collections between tests.
    setupFiles: ["test/setup/setup.ts"],
    pool: "forks",
    testTimeout: 20_000,
    hookTimeout: 120_000, // first run may download the MongoDB binary
    restoreMocks: true,
    unstubEnvs: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/server.ts"],
      reportsDirectory: "test/coverage",
      reporter: ["text", "html", "lcov"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
