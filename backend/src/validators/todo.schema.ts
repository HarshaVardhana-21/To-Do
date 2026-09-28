import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { PRIORITIES } from "../models/Todo.js";

export const idParamSchema = z.object({
  id: z.string().refine((v) => isValidObjectId(v), "Invalid todo id"),
});

const tags = z
  .array(z.string().trim().toLowerCase().min(1).max(30))
  .max(10, "At most 10 tags")
  .transform((t) => [...new Set(t)]);

// null must be tried first: z.coerce.date() would turn null into new Date(null) = 1970-01-01.
const dueDate = z.union([z.null(), z.coerce.date()]);

export const createTodoSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional().default(""),
  priority: z.enum(PRIORITIES).optional().default("medium"),
  dueDate: dueDate.optional().default(null),
  tags: tags.optional().default([]),
  completed: z.boolean().optional().default(false),
});

export const updateTodoSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().trim().max(2000),
    priority: z.enum(PRIORITIES),
    dueDate,
    tags,
    completed: z.boolean(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Provide at least one field to update");

export const listTodosQuerySchema = z.object({
  status: z.enum(["all", "active", "completed"]).default("all"),
  priority: z.enum([...PRIORITIES, "all"]).default("all"),
  search: z.string().trim().max(100).optional(),
  tag: z.string().trim().toLowerCase().max(30).optional(),
  sort: z.enum(["createdAt", "dueDate", "priority", "title"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type ListTodosQuery = z.infer<typeof listTodosQuerySchema>;
