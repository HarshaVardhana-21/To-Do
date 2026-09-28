import request from "supertest";
import { app } from "../../src/app.js";

export { app };

/** Supertest agent bound to the Express app (no network port needed). */
export const api = () => request(app);

let ipCounter = 1;

/**
 * Unique client IP per call so auth tests don't trip the rate limiter on each other.
 * Works because the app sets `trust proxy`, so X-Forwarded-For is honored.
 */
export const freshIp = () => ({ "X-Forwarded-For": `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}` });
