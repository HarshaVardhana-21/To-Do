import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse, delay } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../mocks/server'
import { db } from '../mocks/db'
import { renderApp, waitForPath } from '../helpers/render'
import { AuthProvider } from '../../src/context/AuthContext'
import LoginPage from '../../src/pages/LoginPage'

const field = (label: string) => screen.getByLabelText(label)

describe('LoginPage', () => {
  it('signs in and lands on the dashboard', async () => {
    db.createUser({ name: 'Linus', email: 'linus@example.com', password: 'password123' })
    const { user } = renderApp('/login')
    await user.type(field('Email'), 'linus@example.com')
    await user.type(field('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitForPath('/')
    expect(await screen.findByText('Welcome back!')).toBeInTheDocument() // toast
    expect(screen.getByText('👋')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /, Linus$/ })).toBeInTheDocument()
  })

  it('shows the server error and stays on the page for bad credentials', async () => {
    db.createUser({ email: 'linus@example.com' })
    const { user } = renderApp('/login')
    await user.type(field('Email'), 'linus@example.com')
    await user.type(field('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('shows a network error message when the server is unreachable', async () => {
    server.use(http.post('/api/auth/login', () => HttpResponse.error()))
    const { user } = renderApp('/login')
    await user.type(field('Email'), 'a@example.com')
    await user.type(field('Password'), 'x')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server')
  })

  it('clears a previous error on the next attempt', async () => {
    db.createUser({ email: 'a@example.com', password: 'password123' })
    const { user } = renderApp('/login')
    await user.type(field('Email'), 'a@example.com')
    await user.type(field('Password'), 'bad')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('alert')
    await user.clear(field('Password'))
    await user.type(field('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitForPath('/')
  })

  it('disables the button while signing in', async () => {
    db.createUser({ email: 'a@example.com', password: 'password123' })
    server.use(
      http.post('/api/auth/login', async () => {
        await delay(100)
        return undefined
      }),
    )
    const { user } = renderApp('/login')
    await user.type(field('Email'), 'a@example.com')
    await user.type(field('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
    await waitForPath('/')
  })

  it('uses proper input types and autocomplete hints', () => {
    renderApp('/login')
    expect(field('Email')).toHaveAttribute('type', 'email')
    expect(field('Email')).toHaveAttribute('autocomplete', 'email')
    expect(field('Email')).toBeRequired()
    expect(field('Password')).toHaveAttribute('type', 'password')
    expect(field('Password')).toHaveAttribute('autocomplete', 'current-password')
  })

  it('returns the user to the page they originally requested', async () => {
    db.createUser({ email: 'a@example.com', password: 'password123' })
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/somewhere' } } }]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/somewhere" element={<p>Arrived</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )
    await user.type(field('Email'), 'a@example.com')
    await user.type(field('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Arrived')).toBeInTheDocument()
  })

  it('links to registration', async () => {
    const { user } = renderApp('/login')
    await user.click(screen.getByRole('link', { name: 'Create one' }))
    await waitForPath('/register')
  })
})

describe('RegisterPage', () => {
  async function fill(user: ReturnType<typeof userEvent.setup>, v: { name?: string; email?: string; pw?: string; confirm?: string }) {
    if (v.name) await user.type(field('Name'), v.name)
    if (v.email) await user.type(field('Email'), v.email)
    if (v.pw) await user.type(field('Password'), v.pw)
    if (v.confirm) await user.type(field('Confirm password'), v.confirm)
    await user.click(screen.getByRole('button', { name: 'Create account' }))
  }

  it('creates an account, then sends the user to sign in with the email prefilled', async () => {
    const { user } = renderApp('/register')
    await fill(user, { name: '  Margaret Hamilton ', email: 'mh@example.com', pw: 'apollo1969', confirm: 'apollo1969' })
    await waitForPath('/login')
    expect(await screen.findByText('Account created! Please sign in.')).toBeInTheDocument()
    expect(screen.getByText('🎉')).toBeInTheDocument()
    expect(db.findUserByEmail('mh@example.com')?.name).toBe('Margaret Hamilton') // trimmed
    expect(localStorage.getItem('token')).toBeNull()
    expect(field('Email')).toHaveValue('mh@example.com')
    expect(field('Password')).toHaveFocus()

    await user.type(field('Password'), 'apollo1969')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitForPath('/')
    expect(await screen.findByRole('heading', { name: /, Margaret$/ })).toBeInTheDocument()
  })

  it('rejects a short password before calling the API', async () => {
    let called = false
    server.use(
      http.post('/api/auth/register', () => {
        called = true
        return undefined
      }),
    )
    const { user } = renderApp('/register')
    await fill(user, { name: 'A', email: 'a@example.com', pw: 'short', confirm: 'short' })
    expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 8 characters')
    expect(called).toBe(false)
  })

  it('rejects mismatched passwords before calling the API', async () => {
    const { user } = renderApp('/register')
    await fill(user, { name: 'A', email: 'a@example.com', pw: 'password123', confirm: 'password124' })
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match')
    expect(db.findUserByEmail('a@example.com')).toBeUndefined()
  })

  it('shows the duplicate-email error from the server', async () => {
    db.createUser({ email: 'taken@example.com' })
    const { user } = renderApp('/register')
    await fill(user, { name: 'A', email: 'taken@example.com', pw: 'password123', confirm: 'password123' })
    expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists')
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
  })

  it('shows the first server validation detail', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json(
          { success: false, message: 'Validation failed', details: [{ path: 'email', message: 'Invalid email' }] },
          { status: 400 },
        ),
      ),
    )
    const { user } = renderApp('/register')
    await fill(user, { name: 'A', email: 'a@b.co', pw: 'password123', confirm: 'password123' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email')
  })

  it('has correct autocomplete hints for password managers', () => {
    renderApp('/register')
    expect(field('Password')).toHaveAttribute('autocomplete', 'new-password')
    expect(field('Confirm password')).toHaveAttribute('autocomplete', 'new-password')
    expect(field('Name')).toHaveAttribute('maxLength', '60')
  })

  it('links back to sign in', async () => {
    const { user } = renderApp('/register')
    await user.click(screen.getByRole('link', { name: 'Sign in' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument())
  })
})
