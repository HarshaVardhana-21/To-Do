import { z } from "zod";

// Normalize before validating so " Alice@Example.com " is accepted.
const email = z.string("Invalid email").trim().toLowerCase().pipe(z.email("Invalid email"));

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  email,
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

// The client resizes avatars before upload, so real ones are a few KB; the cap keeps us under the 100kb body limit.
export const AVATAR_MAX_LENGTH = 70_000;
const avatar = z.union([
  z.null(),
  z
    .string()
    .max(AVATAR_MAX_LENGTH, "Profile image is too large")
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/, "Profile image must be a PNG, JPEG or WebP"),
]);

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(60),
    about: z.string().trim().max(500, "About must be at most 500 characters"),
    avatar,
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Provide at least one field to update");

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
