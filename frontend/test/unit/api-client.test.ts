import { afterEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { http, HttpResponse } from 'msw'
import { api, getErrorMessage, setUnauthorizedHandler, tokenStorage } from '../../src/api/client'
import { authApi } from '../../src/api/auth'
import { todosApi } from '../../src/api/todos'
import { server } from '../mocks/server'
import { db } from '../mocks/db'
import { signInAs } from '../helpers/render'

afterEach(() => setUnauthorizedHandler(null))

describe('tokenStorage', () => {
  it('stores, reads and clears the token', () => {
    expect(tokenStorage.get()).toBeNull()
    tokenStorage.set('abc')
    expect(tokenStorage.get()).toBe('abc')
    expect(localStorage.getItem('token')).toBe('abc')
    tokenStorage.clear()
    expect(tokenStorage.get()).toBeNull()
  })

  it('never throws when storage is unavailable (private mode / blocked)', () => {
    const boom = () => {
      throw new DOMException('denied', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom)
    expect(tokenStorage.get()).toBeNull()
    expect(() => tokenStorage.set('x')).not.toThrow()
    expect(() => tokenStorage.clear()).not.toThrow()
  })
})

describe('api instance', () => {
  it('uses /api as the base URL and JSON content type', () => {
    expect(api.defaults.baseURL).toBe('/api')
    expect(api.defaults.headers['Content-Type']).toBe('application/json')
    expect(api.defaults.timeout).toBe(15_000)
  })

  it('attaches the Bearer token when present', async () => {
    let seen: string | null = 'unset'
    server.use(
      http.get('/api/echo', ({ request }) => {
        seen = request.headers.get('Authorization')
        return HttpResponse.json({})
      }),
    )
    await api.get('/echo')
    expect(seen).toBeNull()

    tokenStorage.set('my-token')
    await api.get('/echo')
    expect(seen).toBe('Bearer my-token')
  })

  it('calls the unauthorized handler on a 401 from a protected route', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    server.use(http.get('/api/todos', () => HttpResponse.json({ message: 'expired' }, { status: 401 })))
    await expect(api.get('/todos')).rejects.toBeInstanceOf(AxiosError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('does NOT call the handler for 401s from login/register (wrong password is not a logout)', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    await expect(authApi.login({ email: 'nobody@example.com', password: 'x' })).rejects.toBeInstanceOf(AxiosError)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('does not call the handler for other error statuses', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    server.use(http.get('/api/todos', () => HttpResponse.json({}, { status: 403 })))
    await expect(api.get('/todos')).rejects.toBeTruthy()
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('getErrorMessage', () => {
  const axiosErr = (data: unknown, status = 400, code?: string) =>
    new AxiosError('Request failed', code, undefined, undefined, {
      data,
      status,
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
    })

  it('prefers the first validation detail', () => {
    expect(getErrorMessage(axiosErr({ message: 'Validation failed', details: [{ message: 'Title is required' }] }))).toBe(
      'Title is required',
    )
  })

  it('falls back to the server message', () => {
    expect(getErrorMessage(axiosErr({ message: 'Todo not found' }, 404))).toBe('Todo not found')
  })

  it('reports timeouts', () => {
    const err = new AxiosError('timeout', 'ECONNABORTED')
    expect(getErrorMessage(err)).toBe('Request timed out')
  })

  it('reports network failures', () => {
    expect(getErrorMessage(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe('Cannot reach the server')
  })

  it('uses Error.message for plain errors, and the fallback otherwise', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
    expect(getErrorMessage('weird', 'Fallback')).toBe('Fallback')
    expect(getErrorMessage(undefined)).toBe('Something went wrong')
  })

  it('handles a real network error end to end', async () => {
    server.use(http.get('/api/todos/stats', () => HttpResponse.error()))
    const err = await api.get('/todos/stats').catch((e: unknown) => e)
    expect(getErrorMessage(err)).toBe('Cannot reach the server')
  })

  // Note: a real XHR timeout can't be simulated under MSW + jsdom (the interceptor ignores
  // xhr.timeout), so timeouts are covered by the constructed-error test above.
})

describe('endpoint wrappers', () => {
  it('authApi unwraps the { success, data } envelope', async () => {
    const reg = await authApi.register({ name: 'Ann', email: 'ann@example.com', password: 'password123' })
    expect(reg.user).toMatchObject({ name: 'Ann', email: 'ann@example.com' })
    expect(reg.token).toEqual(expect.any(String))

    tokenStorage.set(reg.token)
    expect((await authApi.me()).email).toBe('ann@example.com')
    expect((await authApi.login({ email: 'ann@example.com', password: 'password123' })).user.name).toBe('Ann')
  })

  it('todosApi.list sends filters as query params and omits blank search', async () => {
    let url: URL | undefined
    server.use(
      http.get('/api/todos', ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ success: true, data: { todos: [], count: 0 } })
      }),
    )
    await todosApi.list({ status: 'active', priority: 'high', search: '   ', sort: 'dueDate', order: 'asc' })
    expect(Object.fromEntries(url!.searchParams)).toEqual({
      status: 'active',
      priority: 'high',
      sort: 'dueDate',
      order: 'asc',
    })

    await todosApi.list({ status: 'all', priority: 'all', search: '  milk ', sort: 'createdAt', order: 'desc' })
    expect(url!.searchParams.get('search')).toBe('milk')
  })

  it('todosApi CRUD round-trip', async () => {
    const { user } = signInAs()
    const created = await todosApi.create({ title: 'Write tests' })
    expect(created.title).toBe('Write tests')

    const updated = await todosApi.update(created.id, { completed: true })
    expect(updated.completed).toBe(true)

    expect(await todosApi.stats()).toEqual({ total: 1, completed: 1, active: 0, overdue: 0 })
    expect(await todosApi.clearCompleted()).toBe(1)

    const again = await todosApi.create({ title: 'Delete me' })
    await todosApi.remove(again.id)
    expect(db.todosFor(user.id)).toHaveLength(0)
  })
})
