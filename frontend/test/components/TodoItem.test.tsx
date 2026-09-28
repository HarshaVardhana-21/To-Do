import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodoItem } from '../../src/components/TodoItem'
import { TodoList, TodoListSkeleton } from '../../src/components/TodoList'
import type { Todo } from '../../src/types'

const base: Todo = {
  id: 't1',
  title: 'Water the plants',
  description: 'Front and back\nand the balcony',
  completed: false,
  completedAt: null,
  priority: 'high',
  dueDate: null,
  tags: ['home', 'garden'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 2, 11, 12))
})
afterEach(() => vi.useRealTimers())

function setup(todo: Partial<Todo> = {}) {
  const handlers = { onToggle: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() }
  const t = { ...base, ...todo }
  render(
    <ul>
      <TodoItem todo={t} {...handlers} />
    </ul>,
  )
  return { ...handlers, todo: t, user: userEvent.setup() }
}

describe('TodoItem', () => {
  it('renders title, description, priority and tags', () => {
    setup()
    expect(screen.getByText('Water the plants')).toBeInTheDocument()
    expect(screen.getByText(/Front and back/)).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('#home')).toBeInTheDocument()
    expect(screen.getByText('#garden')).toBeInTheDocument()
  })

  it('omits the description paragraph and due date when absent', () => {
    setup({ description: '', dueDate: null, tags: [] })
    expect(screen.queryByText(/#/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Today|Tomorrow|Overdue/)).not.toBeInTheDocument()
  })

  it('renders user content as text, not HTML (XSS safe)', () => {
    setup({ title: '<img src=x onerror=alert(1)>', description: '<b>bold</b>' })
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
    expect(document.querySelector('b')).toBeNull()
  })

  it('shows a friendly due date', () => {
    setup({ dueDate: new Date(2026, 2, 12, 23, 59).toISOString() })
    expect(screen.getByText('Tomorrow')).toBeInTheDocument()
  })

  it('flags overdue tasks', () => {
    setup({ dueDate: new Date(2026, 2, 1, 23, 59).toISOString() })
    expect(screen.getByText(/Overdue · Mar 1, 2026/)).toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveClass('border-red-300')
  })

  it('does not flag completed tasks as overdue', () => {
    setup({ completed: true, dueDate: new Date(2026, 2, 1).toISOString() })
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument()
  })

  it('styles completed tasks and exposes the state to assistive tech', () => {
    setup({ completed: true })
    expect(screen.getByText('Water the plants')).toHaveClass('line-through')
    const toggle = screen.getByRole('button', { name: 'Mark as not done' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onToggle / onEdit / onDelete with the todo', async () => {
    const { user, onToggle, onEdit, onDelete, todo } = setup()
    await user.click(screen.getByRole('button', { name: 'Mark as done' }))
    await user.click(screen.getByRole('button', { name: 'Edit task' }))
    await user.click(screen.getByRole('button', { name: 'Delete task' }))
    expect(onToggle).toHaveBeenCalledWith(todo)
    expect(onEdit).toHaveBeenCalledWith(todo)
    expect(onDelete).toHaveBeenCalledWith(todo)
  })

  it('is fully keyboard operable', async () => {
    const { user, onToggle } = setup()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Mark as done' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onToggle).toHaveBeenCalledOnce()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Edit task' })).toHaveFocus()
  })
})

describe('TodoList', () => {
  it('renders one item per todo in order', () => {
    const todos = [
      { ...base, id: 'a', title: 'First' },
      { ...base, id: 'b', title: 'Second' },
    ]
    render(<TodoList todos={todos} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('First')).toBeInTheDocument()
    expect(within(items[1]).getByText('Second')).toBeInTheDocument()
  })

  it('skeleton is marked busy', () => {
    render(<TodoListSkeleton />)
    expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })
})
