import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { http, HttpResponse } from 'msw'
import { AuthProvider } from '../../src/context/AuthContext'
import { useAuth } from '../../src/hooks/useAuth'
import { api } from '../../src/api/client'
import { server } from '../mocks/server'
import { db } from '../mocks/db'
import { signInAs } from '../helpers/render'

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>
const setup = () => renderHook(() => useAuth(), { wrapper })

describe('AuthProvider', () => {
  it('restores the session from a stored token', async () => {
    const { user } = signInAs({ name: 'Rita' })
    const { result } = setup()
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.user).toMatchObject({ id: user.id, name: 'Rita' })
  })

  it('drops an invalid stored token', async () => {
    localStorage.setItem('token', 'stale-token')
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('login stores the token and sets the user', async () => {
    db.createUser({ email: 'sam@example.com', password: 'password123', name: 'Sam' })
    const { result } = setup()
    await act(() => result.current.login('sam@example.com', 'password123'))
    expect(result.current.user?.name).toBe('Sam')
    expect(localStorage.getItem('token')).toEqual(expect.any(String))
  })

  it('login failure leaves the user signed out and rethrows', async () => {
    const { result } = setup()
    await expect(act(() => result.current.login('x@example.com', 'bad'))).rejects.toBeTruthy()
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('register creates the account without signing in', async () => {
    const { result } = setup()
    await act(() => result.current.register('Neo', 'neo@example.com', 'password123'))
    expect(db.findUserByEmail('neo@example.com')?.name).toBe('Neo')
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('updateProfile saves to the API and updates the current user', async () => {
    const { user } = signInAs({ name: 'Rita' })
    const { result } = setup()
    await waitFor(() => expect(result.current.user).not.toBeNull())
    await act(() => result.current.updateProfile({ about: 'Hello there' }))
    expect(result.current.user).toMatchObject({ name: 'Rita', about: 'Hello there' })
    expect(db.findUserById(user.id)?.about).toBe('Hello there')
  })

  it('logout clears the token and user', async () => {
    signInAs()
    const { result } = setup()
    await waitFor(() => expect(result.current.user).not.toBeNull())
    act(() => result.current.logout())
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('logs out automatically when any protected request returns 401', async () => {
    signInAs()
    const { result } = setup()
    await waitFor(() => expect(result.current.user).not.toBeNull())

    server.use(http.get('/api/todos', () => HttpResponse.json({ message: 'expired' }, { status: 401 })))
    await act(() => api.get('/todos').catch(() => {}))

    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
  })
})
