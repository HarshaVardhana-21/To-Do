import { http, HttpResponse, type DefaultBodyType, type StrictRequest } from 'msw'
import type { Priority } from '../../src/types'
import { db } from './db'

const ok = <T,>(data: T, status = 200) => HttpResponse.json({ success: true, data }, { status })
const fail = (status: number, message: string, details?: { path: string; message: string }[]) =>
  HttpResponse.json({ success: false, message, ...(details && { details }) }, { status })

function authUser(request: StrictRequest<DefaultBodyType>) {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const id = db.userIdForToken(header.slice(7))
  return id ? (db.findUserById(id) ?? null) : null
}

const RANK: Record<Priority, number> = { low: 1, medium: 2, high: 3 }

export const handlers = [
  http.post('/api/auth/register', async ({ request }) => {
    const body = (await request.json()) as { name: string; email: string; password: string }
    if (db.findUserByEmail(body.email)) return fail(409, 'An account with this email already exists')
    const user = db.createUser(body)
    return ok({ user: db.publicUser(user), token: db.issueToken(user.id) }, 201)
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string }
    const user = db.findUserByEmail(body.email)
    if (!user || user.password !== body.password) return fail(401, 'Invalid email or password')
    return ok({ user: db.publicUser(user), token: db.issueToken(user.id) })
  }),

  http.get('/api/auth/me', ({ request }) => {
    const user = authUser(request)
    if (!user) return fail(401, 'Invalid or expired token')
    return ok({ user: db.publicUser(user) })
  }),

  http.patch('/api/auth/me', async ({ request }) => {
    const user = authUser(request)
    if (!user) return fail(401, 'Invalid or expired token')
    const body = (await request.json()) as { name?: string; about?: string; avatar?: string | null }
    if (body.name !== undefined) {
      if (!body.name.trim()) return fail(400, 'Validation failed', [{ path: 'name', message: 'Name is required' }])
      user.name = body.name.trim()
    }
    if (body.about !== undefined) user.about = body.about.trim()
    if (body.avatar !== undefined) user.avatar = body.avatar
    user.updatedAt = new Date().toISOString()
    return ok({ user: db.publicUser(user) })
  }),

  http.get('/api/todos/stats', ({ request }) => {
    const user = authUser(request)
    if (!user) return fail(401, 'Invalid or expired token')
    const todos = db.todosFor(user.id)
    const completed = todos.filter((t) => t.completed).length
    const overdue = todos.filter((t) => !t.completed && t.dueDate && new Date(t.dueDate) < new Date()).length
    return ok({ total: todos.length, completed, active: todos.length - completed, overdue })
  }),

  http.get('/api/todos', ({ request }) => {
    const user = authUser(request)
    if (!user) return fail(401, 'Invalid or expired token')
    const q = new URL(request.url).searchParams
    const status = q.get('status') ?? 'all'
    const priority = q.get('priority') ?? 'all'
    const search = q.get('search')?.toLowerCase()
    const sort = q.get('sort') ?? 'createdAt'
    const dir = q.get('order') === 'asc' ? 1 : -1

    let todos = db.todosFor(user.id)
    if (status === 'active') todos = todos.filter((t) => !t.completed)
    if (status === 'completed') todos = todos.filter((t) => t.completed)
    if (priority !== 'all') todos = todos.filter((t) => t.priority === priority)
    if (search) {
      todos = todos.filter((t) =>
        [t.title, t.description, ...t.tags].some((s) => s.toLowerCase().includes(search)),
      )
    }
    const key = (t: (typeof todos)[number]): string | number =>
      sort === 'priority' ? RANK[t.priority] : sort === 'title' ? t.title.toLowerCase() : ((t as never)[sort] ?? '')
    todos = [...todos].sort((a, b) => (key(a) > key(b) ? dir : key(a) < key(b) ? -dir : 0))

    return ok({ todos: todos.map(db.toApi), count: todos.length })
  }),

  http.post('/api/todos', async ({ request }) => {
    const user = authUser(request)
    if (!user) return fail(401, 'Invalid or expired token')
    const body = (await request.json()) as Parameters<typeof db.createTodo>[1]
    if (!body?.title?.trim()) return fail(400, 'Validation failed', [{ path: 'title', message: 'Title is required' }])
    return ok({ todo: db.toApi(db.createTodo(user.id, body)) }, 201)
  }),

  http.delete('/api/todos/completed', ({ request }) => {
    const user = authUser(request)
    if (!user) return fail(401, 'Invalid or expired token')
    return ok({ deletedCount: db.clearCompleted(user.id) })
  }),

  http.patch('/api/todos/:id', async ({ request, params }) => {
    const user = authUser(request)
    if (!user) return fail(401, 'Invalid or expired token')
    const todo = db.findTodo(user.id, params.id as string)
    if (!todo) return fail(404, 'Todo not found')
    const body = (await request.json()) as Partial<typeof todo>
    if (body.completed !== undefined && body.completed !== todo.completed) {
      todo.completedAt = body.completed ? new Date().toISOString() : null
    }
    Object.assign(todo, body, { updatedAt: new Date().toISOString() })
    return ok({ todo: db.toApi(todo) })
  }),

  http.delete('/api/todos/:id', ({ request, params }) => {
    const user = authUser(request)
    if (!user) return fail(401, 'Invalid or expired token')
    if (!db.deleteTodo(user.id, params.id as string)) return fail(404, 'Todo not found')
    return ok({ id: params.id })
  }),
]

/** Helpers for per-test overrides via server.use(...). */
export const errorResponse = fail
