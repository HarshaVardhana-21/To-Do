import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, me, register, updateMe } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, registerSchema, updateProfileSchema } from "../validators/auth.schema.js";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts, please try again later" },
});

const router = Router();

router.post("/register", authLimiter, validate({ body: registerSchema }), register);
router.post("/login", authLimiter, validate({ body: loginSchema }), login);
router.get("/me", requireAuth, me);
router.patch("/me", requireAuth, validate({ body: updateProfileSchema }), updateMe);

export default router;
