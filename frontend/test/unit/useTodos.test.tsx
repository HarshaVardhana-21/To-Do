import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse, delay } from 'msw'
import toast from 'react-hot-toast'
import { useTodos } from '../../src/hooks/useTodos'
import type { TodoFilters } from '../../src/types'
import { server } from '../mocks/server'
import { db } from '../mocks/db'
import { errorResponse } from '../mocks/handlers'
import { signInAs } from '../helpers/render'

const ALL: TodoFilters = { status: 'all', priority: 'all', search: '', sort: 'createdAt', order: 'desc' }

function setup(filters: TodoFilters = ALL) {
  const hook = renderHook((f: TodoFilters) => useTodos(f), { initialProps: filters })
  return hook
}

const loaded = async (hook: ReturnType<typeof setup>) => {
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
  return hook
}

describe('useTodos: loading', () => {
  it('loads todos and stats', async () => {
    const { user } = signInAs()
    db.createTodo(user.id, { title: 'A' })
    db.createTodo(user.id, { title: 'B', completed: true })
    const hook = await loaded(setup())
    expect(hook.result.current.todos.map((t) => t.title).sort()).toEqual(['A', 'B'])
    await waitFor(() => expect(hook.result.current.stats).toEqual({ total: 2, completed: 1, active: 1, overdue: 0 }))
    expect(hook.result.current.error).toBeNull()
  })

  it('refetches when filters change', async () => {
    const { user } = signInAs()
    db.createTodo(user.id, { title: 'Open' })
    db.createTodo(user.id, { title: 'Done', completed: true })
    const hook = await loaded(setup())

    hook.rerender({ ...ALL, status: 'completed' })
    await waitFor(() => expect(hook.result.current.todos.map((t) => t.title)).toEqual(['Done']))
  })

  it('ignores a stale response when filters change quickly (abort)', async () => {
    const { user } = signInAs()
    db.createTodo(user.id, { title: 'Open' })
    db.createTodo(user.id, { title: 'Done', completed: true })
    server.use(
      http.get('/api/todos', async ({ request }) => {
        if (new URL(request.url).searchParams.get('status') === 'active') await delay(150)
        return undefined // fall through to default handler
      }),
    )
    const hook = setup({ ...ALL, status: 'active' })
    hook.rerender({ ...ALL, status: 'completed' })
    await waitFor(() => expect(hook.result.current.todos.map((t) => t.title)).toEqual(['Done']))
    await new Promise((r) => setTimeout(r, 250)) // let the slow request settle
    expect(hook.result.current.todos.map((t) => t.title)).toEqual(['Done'])
  })

  it('exposes an error and can retry', async () => {
    signInAs()
    server.use(http.get('/api/todos', () => errorResponse(500, 'Database unavailable'), { once: true }))
    const hook = await loaded(setup())
    expect(hook.result.current.error).toBe('Database unavailable')

    await act(() => hook.result.current.retry())
    expect(hook.result.current.error).toBeNull()
  })

  it('tolerates a failing stats endpoint', async () => {
    signInAs()
    server.use(http.get('/api/todos/stats', () => errorResponse(500, 'nope')))
    const hook = await loaded(setup())
    expect(hook.result.current.stats).toEqual({ total: 0, completed: 0, active: 0, overdue: 0 })
    expect(hook.result.current.error).toBeNull()
  })
})

describe('useTodos: mutations', () => {
  it('createTodo adds, refetches, toasts and returns true', async () => {
    signInAs()
    const success = vi.spyOn(toast, 'success')
    const hook = await loaded(setup())
    let ok: boolean | undefined
    await act(async () => {
      ok = await hook.result.current.createTodo({ title: 'New one' })
    })
    expect(ok).toBe(true)
    expect(hook.result.current.todos.map((t) => t.title)).toEqual(['New one'])
    expect(hook.result.current.stats.total).toBe(1)
    expect(success).toHaveBeenCalledWith('Task added', { icon: '📝' })
  })

  it('createTodo returns false and shows the server error on failure', async () => {
    signInAs()
    const error = vi.spyOn(toast, 'error')
    const hook = await loaded(setup())
    let ok: boolean | undefined
    await act(async () => {
      ok = await hook.result.current.createTodo({ title: '  ' })
    })
    expect(ok).toBe(false)
    expect(error).toHaveBeenCalledWith('Title is required', { icon: '😬' })
  })

  it('toggleTodo updates optimistically before the server responds', async () => {
    const { user } = signInAs()
    const t = db.createTodo(user.id, { title: 'Toggle me' })
    let release!: () => void
    server.use(
      http.patch('/api/todos/:id', async () => {
        await new Promise<void>((r) => (release = r))
        return undefined
      }),
    )
    const hook = await loaded(setup())
    let pending!: Promise<boolean>
    act(() => {
      pending = hook.result.current.toggleTodo(hook.result.current.todos[0])
    })
    expect(hook.result.current.todos[0].completed).toBe(true) // before server answered
    await waitFor(() => expect(release).toBeDefined())
    release()
    await act(() => pending)
    expect(db.findTodo(user.id, t.id)?.completed).toBe(true)
  })

  it('toggle does not show a success toast (silent)', async () => {
    const { user } = signInAs()
    db.createTodo(user.id)
    const success = vi.spyOn(toast, 'success')
    const hook = await loaded(setup())
    await act(() => hook.result.current.toggleTodo(hook.result.current.todos[0]))
    expect(success).not.toHaveBeenCalled()
  })

  it('rolls back an optimistic update when the server rejects it', async () => {
    const { user } = signInAs()
    db.createTodo(user.id, { title: 'Stable' })
    server.use(http.patch('/api/todos/:id', () => errorResponse(500, 'Write failed')))
    const error = vi.spyOn(toast, 'error')
    const hook = await loaded(setup())
    let ok: boolean | undefined
    await act(async () => {
      ok = await hook.result.current.updateTodo(hook.result.current.todos[0].id, { title: 'Changed' })
    })
    expect(ok).toBe(false)
    expect(hook.result.current.todos[0].title).toBe('Stable')
    expect(error).toHaveBeenCalledWith('Write failed', { icon: '🙈' })
  })

  it('removes a todo from the list when an update makes it stop matching the filter', async () => {
    const { user } = signInAs()
    db.createTodo(user.id, { title: 'Active one' })
    const hook = await loaded(setup({ ...ALL, status: 'active' }))
    await act(() => hook.result.current.toggleTodo(hook.result.current.todos[0]))
    expect(hook.result.current.todos).toEqual([])
  })

  it('deleteTodo removes optimistically and rolls back on failure', async () => {
    const { user } = signInAs()
    db.createTodo(user.id, { title: 'Keep' })
    const hook = await loaded(setup())
    const id = hook.result.current.todos[0].id

    server.use(http.delete('/api/todos/:id', () => errorResponse(500, 'Delete failed'), { once: true }))
    await act(() => hook.result.current.deleteTodo(id))
    expect(hook.result.current.todos.map((t) => t.id)).toEqual([id])

    await act(() => hook.result.current.deleteTodo(id))
    expect(hook.result.current.todos).toEqual([])
    expect(db.todosFor(user.id)).toHaveLength(0)
  })

  it('clearCompleted reports the count', async () => {
    const { user } = signInAs()
    db.createTodo(user.id, { completed: true })
    db.createTodo(user.id, { completed: true })
    db.createTodo(user.id)
    const success = vi.spyOn(toast, 'success')
    const hook = await loaded(setup())
    await act(() => hook.result.current.clearCompleted())
    expect(success).toHaveBeenCalledWith('Cleared 2 completed tasks', { icon: '🧹' })
    expect(hook.result.current.todos).toHaveLength(1)
  })

  it('clearCompleted uses singular / "nothing" wording', async () => {
    const { user } = signInAs()
    db.createTodo(user.id, { completed: true })
    const success = vi.spyOn(toast, 'success')
    const hook = await loaded(setup())
    await act(() => hook.result.current.clearCompleted())
    expect(success).toHaveBeenLastCalledWith('Cleared 1 completed task', { icon: '🧹' })
    await act(() => hook.result.current.clearCompleted())
    expect(success).toHaveBeenLastCalledWith('Nothing to clear', { icon: '🤷' })
  })

  it('clearCompleted shows an error on failure', async () => {
    signInAs()
    server.use(http.delete('/api/todos/completed', () => errorResponse(500, 'Nope')))
    const error = vi.spyOn(toast, 'error')
    const hook = await loaded(setup())
    await act(() => hook.result.current.clearCompleted())
    expect(error).toHaveBeenCalledWith('Nope', { icon: '🌪️' })
  })
})
