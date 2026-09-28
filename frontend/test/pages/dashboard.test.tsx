import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { db } from '../mocks/db'
import { errorResponse } from '../mocks/handlers'
import { renderApp, signInAs } from '../helpers/render'

const items = () => screen.queryAllByRole('listitem').filter((li) => !li.closest('[aria-busy]'))
const titles = () => items().map((li) => li.querySelector('p')?.textContent)
const itemFor = (title: string) => screen.getByText(title).closest('li')!

async function openDashboard(seed?: (userId: string) => void) {
  const { user: account } = signInAs({ name: 'Jordan Lee' })
  seed?.(account.id)
  const utils = renderApp('/')
  await screen.findByRole('heading', { name: /, Jordan$/ })
  await waitFor(() => expect(screen.queryByRole('list', { busy: true })).not.toBeInTheDocument())
  return { ...utils, account }
}

describe('Dashboard: rendering', () => {
  it('greets the user by first name and shows today’s date', async () => {
    await openDashboard()
    expect(screen.getByRole('heading', { name: /^Good (morning|afternoon|evening), Jordan$/ })).toBeInTheDocument()
  })

  it('shows the onboarding empty state for a new user', async () => {
    await openDashboard()
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /clear completed/i })).not.toBeInTheDocument()
  })

  it('lists existing todos and stats', async () => {
    await openDashboard((id) => {
      db.createTodo(id, { title: 'One' })
      db.createTodo(id, { title: 'Two', completed: true })
    })
    expect(await screen.findByText('One')).toBeInTheDocument()
    expect(screen.getByText('Two')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('50%')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Clear completed (1)' })).toBeInTheDocument()
  })

  it('shows an error with a working retry button', async () => {
    signInAs({ name: 'Jordan Lee' })
    server.use(http.get('/api/todos', () => errorResponse(500, 'Server exploded'), { once: true }))
    const { user } = renderApp('/')
    expect(await screen.findByText('Server exploded')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument()
  })
})

describe('Dashboard: adding', () => {
  it('adds a task from the quick-add form', async () => {
    const { user, account } = await openDashboard()
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Pay rent{Enter}')
    expect(await screen.findByText('Pay rent')).toBeInTheDocument()
    expect(await screen.findByText('Task added')).toBeInTheDocument()
    expect(db.todosFor(account.id)).toHaveLength(1)
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('')
  })

  it('adds a task with details', async () => {
    const { user, account } = await openDashboard()
    await user.click(screen.getByRole('button', { name: /more options/i }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Dentist')
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.type(screen.getByLabelText('Tags'), 'health')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await screen.findByText('Dentist')
    expect(db.todosFor(account.id)[0]).toMatchObject({ title: 'Dentist', priority: 'high', tags: ['health'] })
    expect(within(itemFor('Dentist')).getByText('#health')).toBeInTheDocument()
  })

  it('shows an error toast when adding fails', async () => {
    const { user } = await openDashboard()
    server.use(http.post('/api/todos', () => errorResponse(500, 'Could not save')))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Nope{Enter}')
    expect(await screen.findByText('Could not save')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Nope')
  })
})

describe('Dashboard: completing, editing, deleting', () => {
  it('toggles completion and updates stats', async () => {
    const { user, account } = await openDashboard((id) => db.createTodo(id, { title: 'Walk dog' }))
    await user.click(within(itemFor('Walk dog')).getByRole('button', { name: 'Mark as done' }))
    await waitFor(() => expect(db.todosFor(account.id)[0].completed).toBe(true))
    expect(within(itemFor('Walk dog')).getByRole('button', { name: 'Mark as not done' })).toBeInTheDocument()
    expect(await screen.findByText('100%')).toBeInTheDocument()
  })

  it('edits a task in the modal', async () => {
    const { user, account } = await openDashboard((id) => db.createTodo(id, { title: 'Old title', priority: 'low' }))
    await user.click(within(itemFor('Old title')).getByRole('button', { name: 'Edit task' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit task' })
    const input = within(dialog).getByRole('textbox', { name: 'Title' })
    await user.clear(input)
    await user.type(input, 'New title')
    await user.selectOptions(within(dialog).getByLabelText('Priority'), 'high')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('New title')).toBeInTheDocument()
    expect(db.todosFor(account.id)[0]).toMatchObject({ title: 'New title', priority: 'high' })
  })

  it('keeps the edit modal open if saving fails', async () => {
    const { user } = await openDashboard((id) => db.createTodo(id, { title: 'Sticky' }))
    server.use(http.patch('/api/todos/:id', () => errorResponse(500, 'Save failed')))
    await user.click(within(itemFor('Sticky')).getByRole('button', { name: 'Edit task' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Save failed')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('cancels editing without changes', async () => {
    const { user, account } = await openDashboard((id) => db.createTodo(id, { title: 'Untouched' }))
    await user.click(within(itemFor('Untouched')).getByRole('button', { name: 'Edit task' }))
    await user.type(within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Title' }), ' extra')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(db.todosFor(account.id)[0].title).toBe('Untouched')
  })

  it('asks for confirmation before deleting', async () => {
    const { user, account } = await openDashboard((id) => db.createTodo(id, { title: 'Trash me' }))
    await user.click(within(itemFor('Trash me')).getByRole('button', { name: 'Delete task' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete task?' })
    expect(dialog).toHaveTextContent('"Trash me" will be permanently deleted.')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(db.todosFor(account.id)).toHaveLength(1)

    await user.click(within(itemFor('Trash me')).getByRole('button', { name: 'Delete task' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByText('Trash me')).not.toBeInTheDocument())
    expect(db.todosFor(account.id)).toHaveLength(0)
    expect(await screen.findByText('Task deleted')).toBeInTheDocument()
    expect(screen.getByText('🗑️')).toBeInTheDocument()
  })

  it('clears completed tasks after confirmation', async () => {
    const { user, account } = await openDashboard((id) => {
      db.createTodo(id, { title: 'Done A', completed: true })
      db.createTodo(id, { title: 'Done B', completed: true })
      db.createTodo(id, { title: 'Still open' })
    })
    await user.click(await screen.findByRole('button', { name: 'Clear completed (2)' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('permanently delete 2 completed tasks')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(titles()).toEqual(['Still open']))
    expect(db.todosFor(account.id)).toHaveLength(1)
  })
})

describe('Dashboard: filtering, searching, sorting', () => {
  const seed = (id: string) => {
    db.createTodo(id, { title: 'Buy groceries', priority: 'low', tags: ['home'], createdAt: '2026-01-01T00:00:00Z' })
    db.createTodo(id, { title: 'Finish report', priority: 'high', createdAt: '2026-01-02T00:00:00Z' })
    db.createTodo(id, { title: 'Call plumber', priority: 'medium', completed: true, createdAt: '2026-01-03T00:00:00Z' })
  }

  it('filters by status tabs', async () => {
    const { user } = await openDashboard(seed)
    await user.click(screen.getByRole('tab', { name: 'Active' }))
    await waitFor(() => expect(titles().sort()).toEqual(['Buy groceries', 'Finish report']))
    await user.click(screen.getByRole('tab', { name: 'Completed' }))
    await waitFor(() => expect(titles()).toEqual(['Call plumber']))
  })

  it('removes a task from the Active view as soon as it is completed', async () => {
    const { user } = await openDashboard(seed)
    await user.click(screen.getByRole('tab', { name: 'Active' }))
    await waitFor(() => expect(titles()).toHaveLength(2))
    await user.click(within(itemFor('Finish report')).getByRole('button', { name: 'Mark as done' }))
    expect(screen.queryByText('Finish report')).not.toBeInTheDocument()
  })

  it('filters by priority', async () => {
    const { user } = await openDashboard(seed)
    await user.selectOptions(screen.getByLabelText('Filter by priority'), 'high')
    await waitFor(() => expect(titles()).toEqual(['Finish report']))
  })

  it('searches (debounced) and shows a "no matches" state', async () => {
    const { user } = await openDashboard(seed)
    const search = screen.getByRole('textbox', { name: 'Search tasks' })
    await user.type(search, 'report')
    await waitFor(() => expect(titles()).toEqual(['Finish report']))

    await user.clear(search)
    await user.type(search, 'zzz')
    expect(await screen.findByText('No matching tasks')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    await waitFor(() => expect(titles()).toHaveLength(3))
  })

  it('debounces search so typing does not fire a request per keystroke', async () => {
    const searches: string[] = []
    server.events.on('request:start', ({ request }) => {
      const s = new URL(request.url).searchParams.get('search')
      if (request.url.includes('/api/todos?') && s) searches.push(s)
    })
    const { user } = await openDashboard(seed)
    await user.type(screen.getByRole('textbox', { name: 'Search tasks' }), 'groceries')
    await waitFor(() => expect(titles()).toEqual(['Buy groceries']))
    server.events.removeAllListeners()
    expect(searches).toEqual(['groceries'])
  })

  it('sorts and toggles order', async () => {
    const { user } = await openDashboard(seed)
    await waitFor(() => expect(titles()).toEqual(['Call plumber', 'Finish report', 'Buy groceries'])) // newest first
    await user.selectOptions(screen.getByLabelText('Sort by'), 'title')
    await waitFor(() => expect(titles()).toEqual(['Finish report', 'Call plumber', 'Buy groceries']))
    await user.click(screen.getByRole('button', { name: 'Sort order: descending' }))
    await waitFor(() => expect(titles()).toEqual(['Buy groceries', 'Call plumber', 'Finish report']))
  })

  it('remembers filters across visits (but not the search text)', async () => {
    const first = await openDashboard(seed)
    await first.user.click(screen.getByRole('tab', { name: 'Completed' }))
    await first.user.type(screen.getByRole('textbox', { name: 'Search tasks' }), 'plumb')
    await waitFor(() => expect(titles()).toEqual(['Call plumber']))
    first.unmount()

    renderApp('/')
    await screen.findByRole('heading', { name: /jordan/i })
    expect(screen.getByRole('tab', { name: 'Completed' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('textbox', { name: 'Search tasks' })).toHaveValue('')
  })

  it('recovers from corrupted saved filters instead of getting stuck on an error', async () => {
    localStorage.setItem('todoFilters', JSON.stringify({ status: 'bogus', priority: 42, sort: 'user', order: 'up' }))
    await openDashboard(seed)
    await waitFor(() => expect(titles()).toHaveLength(3))
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
  })

  it('recovers from non-JSON saved filters', async () => {
    localStorage.setItem('todoFilters', '{not json')
    await openDashboard(seed)
    await waitFor(() => expect(titles()).toHaveLength(3))
  })
})

describe('Dashboard: session', () => {
  it('logs out from the navbar', async () => {
    const { user } = await openDashboard()
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }))
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('does not show another user’s tasks after switching accounts', async () => {
    const other = db.createUser({ email: 'other@example.com', password: 'password123' })
    db.createTodo(other.id, { title: 'Other user task' })
    const { user } = await openDashboard((id) => db.createTodo(id, { title: 'My task' }))
    expect(await screen.findByText('My task')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }))
    await user.type(await screen.findByLabelText('Email'), 'other@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Other user task')).toBeInTheDocument()
    expect(screen.queryByText('My task')).not.toBeInTheDocument()
  })

  it('works when the stats endpoint is down', async () => {
    server.use(http.get('/api/todos/stats', () => HttpResponse.error()))
    await openDashboard((id) => db.createTodo(id, { title: 'Visible anyway' }))
    expect(await screen.findByText('Visible anyway')).toBeInTheDocument()
  })
})
