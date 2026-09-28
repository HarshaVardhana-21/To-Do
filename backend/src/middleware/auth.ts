import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { verifyToken } from "../utils/jwt.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Missing or malformed Authorization header"));
  }
  let sub: string;
  try {
    sub = verifyToken(header.slice(7)).sub;
  } catch {
    return next(ApiError.unauthorized("Invalid or expired token"));
  }
  // A signed token whose subject isn't a user id would otherwise surface later as a 400/500.
  if (!OBJECT_ID_RE.test(sub)) return next(ApiError.unauthorized("Invalid or expired token"));
  req.userId = sub;
  next();
}

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/** Returns the authenticated user id; only call behind `requireAuth`. */
export function authUserId(req: Request): string {
  if (!req.userId) throw ApiError.unauthorized();
  return req.userId;
}
