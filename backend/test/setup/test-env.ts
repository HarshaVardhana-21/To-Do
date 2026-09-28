/** Env values shared by the test process and any child processes the tests spawn. */
export const TEST_JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters-long";

export const TEST_CLIENT_URL = "http://localhost:5173,http://allowed.example.com";

export function applyTestEnv(mongoUri: string) {
  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI = mongoUri;
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.JWT_EXPIRES_IN = "1h";
  process.env.CLIENT_URL = TEST_CLIENT_URL;
  process.env.PORT = "5999"; // never bound: supertest uses the app directly
}
