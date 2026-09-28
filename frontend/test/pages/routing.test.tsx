import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse, delay } from 'msw'
import App from '../../src/App'
import { server } from '../mocks/server'
import { currentPath, renderApp, signInAs, waitForPath } from '../helpers/render'

describe('routing & guards', () => {
  it('redirects a signed-out visitor from / to /login', async () => {
    renderApp('/')
    await waitForPath('/login')
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('shows a spinner (not the login page) while restoring a session', async () => {
    signInAs()
    server.use(
      http.get('/api/auth/me', async () => {
        await delay(100)
        return undefined
      }),
    )
    renderApp('/')
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(currentPath()).toBe('/')
    expect(await screen.findByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeInTheDocument()
  })

  it('keeps a returning user signed in', async () => {
    signInAs({ name: 'Grace Hopper' })
    renderApp('/')
    expect(await screen.findByRole('heading', { name: /, Grace$/ })).toBeInTheDocument()
  })

  it('redirects signed-in users away from /login and /register', async () => {
    signInAs()
    renderApp('/login')
    await waitForPath('/')
  })

  it('sends users with an expired token to /login and clears it', async () => {
    localStorage.setItem('token', 'expired')
    renderApp('/')
    await waitForPath('/login')
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('logs the user out and redirects when the token expires mid-session', async () => {
    signInAs()
    const { user } = renderApp('/')
    await screen.findByRole('heading', { name: /good/i })

    server.use(http.get('/api/todos', () => HttpResponse.json({ message: 'expired' }, { status: 401 })))
    await user.click(screen.getByRole('tab', { name: 'Completed' }))
    await waitForPath('/login')
  })

  it('shows the 404 page for unknown routes, with a way back', async () => {
    const { user } = renderApp('/nope/really')
    expect(screen.getByText('404')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Back to tasks' }))
    await waitForPath('/login') // "/" is protected
  })

  it('App mounts with BrowserRouter without crashing', async () => {
    window.history.pushState({}, '', '/login')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })
})
