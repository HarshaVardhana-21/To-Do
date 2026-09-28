import type { Priority, Todo, User } from '../../src/types'

/**
 * In-memory stand-in for the backend's data, used by the MSW handlers.
 * Mirrors the real API's behavior closely enough for UI tests.
 */
interface StoredUser extends User {
  password: string
}

let seq = 0
const nextId = () => (++seq).toString(16).padStart(24, '0')

const state = {
  users: [] as StoredUser[],
  todos: [] as (Todo & { userId: string })[],
  tokens: new Map<string, string>(), // token -> userId
}

export const db = {
  reset() {
    seq = 0
    state.users = []
    state.todos = []
    state.tokens.clear()
  },

  createUser(input: { name?: string; email?: string; password?: string; about?: string; avatar?: string | null } = {}) {
    const now = new Date().toISOString()
    const user: StoredUser = {
      id: nextId(),
      name: input.name ?? 'Test User',
      email: (input.email ?? `user${seq}@example.com`).toLowerCase(),
      password: input.password ?? 'password123',
      about: input.about ?? '',
      avatar: input.avatar ?? null,
      createdAt: now,
      updatedAt: now,
    }
    state.users.push(user)
    return user
  },

  findUserByEmail: (email: string) => state.users.find((u) => u.email === email.toLowerCase()),
  findUserById: (id: string) => state.users.find((u) => u.id === id),
  publicUser: ({ password: _pw, ...rest }: StoredUser): User => rest,

  issueToken(userId: string) {
    const token = `token-${userId}-${Math.random().toString(36).slice(2)}`
    state.tokens.set(token, userId)
    return token
  },
  userIdForToken: (token: string) => state.tokens.get(token),
  revokeAllTokens: () => state.tokens.clear(),

  createTodo(
    userId: string,
    input: Partial<Pick<Todo, 'title' | 'description' | 'priority' | 'dueDate' | 'tags' | 'completed' | 'createdAt'>> = {},
  ) {
    const now = input.createdAt ?? new Date(Date.now() + seq).toISOString()
    const todo = {
      id: nextId(),
      userId,
      title: input.title ?? `Todo ${seq}`,
      description: input.description ?? '',
      completed: input.completed ?? false,
      completedAt: input.completed ? now : null,
      priority: (input.priority ?? 'medium') as Priority,
      dueDate: input.dueDate ?? null,
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
    }
    state.todos.push(todo)
    return todo
  },

  todosFor: (userId: string) => state.todos.filter((t) => t.userId === userId),
  findTodo: (userId: string, id: string) => state.todos.find((t) => t.userId === userId && t.id === id),
  deleteTodo(userId: string, id: string) {
    const before = state.todos.length
    state.todos = state.todos.filter((t) => !(t.userId === userId && t.id === id))
    return state.todos.length < before
  },
  clearCompleted(userId: string) {
    const before = state.todos.length
    state.todos = state.todos.filter((t) => !(t.userId === userId && t.completed))
    return before - state.todos.length
  },

  toApi: ({ userId: _u, ...todo }: Todo & { userId: string }): Todo => todo,
}
