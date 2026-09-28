import type { Request, Response } from "express";
import { Types, type SortOrder } from "mongoose";
import { Todo } from "../models/Todo.js";
import { ApiError } from "../utils/ApiError.js";
import { authUserId } from "../middleware/auth.js";
import type { CreateTodoInput, ListTodosQuery, UpdateTodoInput } from "../validators/todo.schema.js";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function listTodos(req: Request, res: Response) {
  const userId = authUserId(req);
  const { status, priority, search, tag, sort, order } = req.query as unknown as ListTodosQuery;

  const filter: Record<string, unknown> = { user: userId };
  if (status === "active") filter.completed = false;
  if (status === "completed") filter.completed = true;
  if (priority !== "all") filter.priority = priority;
  if (tag) filter.tags = tag;
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ title: rx }, { description: rx }, { tags: rx }];
  }

  const dir: SortOrder = order === "asc" ? 1 : -1;
  const sortField = sort === "priority" ? "priorityRank" : sort;
  // Tie-break newest first, then by _id for a deterministic order. When sorting by createdAt
  // itself, the tie-break must not overwrite the requested direction.
  const sortSpec: Record<string, SortOrder> = { [sortField]: dir };
  if (sortField !== "createdAt") sortSpec.createdAt = -1;
  sortSpec._id = sortField === "createdAt" ? dir : -1;

  let query = Todo.find(filter).sort(sortSpec);
  // Case-insensitive ordering for titles ("apple" before "Banana").
  if (sort === "title") query = query.collation({ locale: "en", strength: 2 });
  const todos = await query;

  // Todos without a due date always go last when sorting by due date (stable sort keeps order).
  if (sort === "dueDate") {
    todos.sort((a, b) => Number(a.dueDate == null) - Number(b.dueDate == null));
  }

  res.json({ success: true, data: { todos, count: todos.length } });
}

export async function getStats(req: Request, res: Response) {
  const user = new Types.ObjectId(authUserId(req));
  const now = new Date();

  const [stats] = await Todo.aggregate<{ total: number; completed: number; overdue: number }>([
    { $match: { user } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: ["$completed", 1, 0] } },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$completed", false] },
                  { $ne: ["$dueDate", null] },
                  { $lt: ["$dueDate", now] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const total = stats?.total ?? 0;
  const completed = stats?.completed ?? 0;
  res.json({
    success: true,
    data: { total, completed, active: total - completed, overdue: stats?.overdue ?? 0 },
  });
}

export async function createTodo(req: Request, res: Response) {
  const input = req.body as CreateTodoInput;
  const todo = await Todo.create({
    ...input,
    user: authUserId(req),
    completedAt: input.completed ? new Date() : null,
  });
  res.status(201).json({ success: true, data: { todo } });
}

async function findOwnedTodo(req: Request) {
  const todo = await Todo.findOne({ _id: req.params.id, user: authUserId(req) });
  if (!todo) throw ApiError.notFound("Todo not found");
  return todo;
}

export async function getTodo(req: Request, res: Response) {
  res.json({ success: true, data: { todo: await findOwnedTodo(req) } });
}

export async function updateTodo(req: Request, res: Response) {
  const updates = req.body as UpdateTodoInput;
  const todo = await findOwnedTodo(req);

  if (updates.completed !== undefined && updates.completed !== todo.completed) {
    todo.completedAt = updates.completed ? new Date() : null;
  }
  todo.set(updates);
  await todo.save();

  res.json({ success: true, data: { todo } });
}

export async function deleteTodo(req: Request, res: Response) {
  const todo = await findOwnedTodo(req);
  await todo.deleteOne();
  res.json({ success: true, data: { id: todo.id } });
}

export async function clearCompleted(req: Request, res: Response) {
  const { deletedCount } = await Todo.deleteMany({ user: authUserId(req), completed: true });
  res.json({ success: true, data: { deletedCount } });
}
