import type { ReactElement, ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '../../src/context/AuthContext'
import { ProtectedRoute, PublicOnlyRoute } from '../../src/components/ProtectedRoute'
import DashboardPage from '../../src/pages/DashboardPage'
import LoginPage from '../../src/pages/LoginPage'
import RegisterPage from '../../src/pages/RegisterPage'
import NotFoundPage from '../../src/pages/NotFoundPage'
import { db } from '../mocks/db'

/** Shows the current path so tests can assert on navigation. */
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

/** The real route tree from App.tsx, but inside a MemoryRouter so tests control the URL. */
export function AppRoutes() {
  return (
    <>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <LocationProbe />
    </>
  )
}

export function renderApp(path = '/') {
  const user = userEvent.setup()
  const utils = render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </MemoryRouter>,
  )
  return { user, ...utils }
}

/** Renders a single component with router + auth context available. */
export function renderWithProviders(ui: ReactElement, { path = '/' }: { path?: string } = {}) {
  const user = userEvent.setup()
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  )
  return { user, ...render(ui, { wrapper: Wrapper }) }
}

/** Creates a user in the mock backend and stores a valid token, like a returning visitor. */
export function signInAs(input: Parameters<typeof db.createUser>[0] = {}) {
  const user = db.createUser(input)
  const token = db.issueToken(user.id)
  localStorage.setItem('token', token)
  return { user, token }
}

export const currentPath = () => screen.getByTestId('location').textContent

export async function waitForPath(path: string) {
  await waitFor(() => {
    if (currentPath() !== path) throw new Error(`expected ${path}, at ${currentPath()}`)
  })
}
