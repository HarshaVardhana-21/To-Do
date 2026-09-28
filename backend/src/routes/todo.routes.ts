import { Router } from "express";
import {
  clearCompleted,
  createTodo,
  deleteTodo,
  getStats,
  getTodo,
  listTodos,
  updateTodo,
} from "../controllers/todo.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createTodoSchema,
  idParamSchema,
  listTodosQuerySchema,
  updateTodoSchema,
} from "../validators/todo.schema.js";

const router = Router();

router.use(requireAuth);

router.get("/", validate({ query: listTodosQuerySchema }), listTodos);
router.post("/", validate({ body: createTodoSchema }), createTodo);
router.get("/stats", getStats);
// Registered before "/:id" so "completed" isn't treated as an id.
router.delete("/completed", clearCompleted);

router.get("/:id", validate({ params: idParamSchema }), getTodo);
router.patch("/:id", validate({ params: idParamSchema, body: updateTodoSchema }), updateTodo);
router.delete("/:id", validate({ params: idParamSchema }), deleteTodo);

export default router;
