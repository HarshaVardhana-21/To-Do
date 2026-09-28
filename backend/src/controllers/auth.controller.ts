import type { Request, Response } from "express";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { signToken } from "../utils/jwt.js";
import { authUserId } from "../middleware/auth.js";
import type { LoginInput, RegisterInput, UpdateProfileInput } from "../validators/auth.schema.js";

export async function register(req: Request, res: Response) {
  const { name, email, password } = req.body as RegisterInput;

  if (await User.exists({ email })) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const user = await User.create({ name, email, password });
  res.status(201).json({ success: true, data: { user, token: signToken(user.id) } });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as LoginInput;

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  res.json({ success: true, data: { user, token: signToken(user.id) } });
}

export async function me(req: Request, res: Response) {
  const user = await User.findById(authUserId(req));
  if (!user) throw ApiError.unauthorized("User no longer exists");
  res.json({ success: true, data: { user } });
}

export async function updateMe(req: Request, res: Response) {
  const user = await User.findById(authUserId(req));
  if (!user) throw ApiError.unauthorized("User no longer exists");
  user.set(req.body as UpdateProfileInput);
  await user.save();
  res.json({ success: true, data: { user } });
}
