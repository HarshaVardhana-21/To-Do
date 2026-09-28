import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi } from '../api/auth'
import { setUnauthorizedHandler, tokenStorage } from '../api/client'
import type { ProfileInput, User } from '../types'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(() => Boolean(tokenStorage.get()))

  const logout = useCallback(() => {
    tokenStorage.clear()
    setUser(null)
  }, [])

  // Restore the session from a stored token on first load.
  useEffect(() => {
    if (!tokenStorage.get()) return
    authApi
      .me()
      .then(setUser)
      .catch(() => tokenStorage.clear())
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password })
    tokenStorage.set(res.token)
    setUser(res.user)
  }, [])

  // Registration only creates the account; the user signs in afterwards on the login page.
  const register = useCallback(async (name: string, email: string, password: string) => {
    await authApi.register({ name, email, password })
  }, [])

  const updateProfile = useCallback(async (input: ProfileInput) => {
    setUser(await authApi.updateProfile(input))
  }, [])

  const value = useMemo(
    () => ({ user, isLoading, login, register, updateProfile, logout }),
    [user, isLoading, login, register, updateProfile, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
