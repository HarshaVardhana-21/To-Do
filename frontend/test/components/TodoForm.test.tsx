import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodoForm } from '../../src/components/TodoForm'
import type { Todo } from '../../src/types'

const existing: Todo = {
  id: 'x',
  title: 'Existing task',
  description: 'Some notes',
  completed: false,
  completedAt: null,
  priority: 'high',
  dueDate: new Date(2026, 5, 15, 23, 59, 59).toISOString(),
  tags: ['work', 'q2'],
  createdAt: '',
  updatedAt: '',
}

function setup(props: Partial<Parameters<typeof TodoForm>[0]> = {}) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(true)
  render(<TodoForm onSubmit={onSubmit} {...props} />)
  return { onSubmit: onSubmit as ReturnType<typeof vi.fn>, user: userEvent.setup() }
}

const title = () => screen.getByRole('textbox', { name: 'Title' })

describe('TodoForm (compact / add mode)', () => {
  it('shows only the title field until expanded', async () => {
    const { user } = setup({ compact: true })
    expect(screen.queryByLabelText('Priority')).not.toBeInTheDocument()
    const more = screen.getByRole('button', { name: /more options/i })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    await user.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Priority')).toBeInTheDocument()
    expect(screen.getByLabelText('Due date')).toBeInTheDocument()
    expect(screen.getByLabelText('Tags')).toBeInTheDocument()
  })

  it('disables Add until a non-blank title is entered', async () => {
    const { user } = setup({ compact: true })
    const add = screen.getByRole('button', { name: /add/i })
    expect(add).toBeDisabled()
    await user.type(title(), '   ')
    expect(add).toBeDisabled()
    await user.type(title(), 'x')
    expect(add).toBeEnabled()
  })

  it('submits trimmed values with defaults and resets on success', async () => {
    const { user, onSubmit } = setup({ compact: true })
    await user.type(title(), '  Buy milk  {Enter}')
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Buy milk',
      description: '',
      priority: 'medium',
      dueDate: null,
      tags: [],
    })
    await waitFor(() => expect(title()).toHaveValue(''))
  })

  it('submits all optional fields', async () => {
    const { user, onSubmit } = setup({ compact: true })
    await user.click(screen.getByRole('button', { name: /more options/i }))
    await user.type(title(), 'Plan trip')
    await user.type(screen.getByLabelText('Description'), 'Book flights')
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.type(screen.getByLabelText('Due date'), '2026-08-20')
    await user.type(screen.getByLabelText('Tags'), 'Travel, travel, fun')
    await user.click(screen.getByRole('button', { name: /add/i }))

    const arg = onSubmit.mock.calls[0][0]
    expect(arg).toMatchObject({ title: 'Plan trip', description: 'Book flights', priority: 'high', tags: ['travel', 'fun'] })
    const due = new Date(arg.dueDate)
    expect([due.getFullYear(), due.getMonth(), due.getDate()]).toEqual([2026, 7, 20])
  })

  it('keeps the input when submission fails', async () => {
    const { user } = setup({ compact: true, onSubmit: vi.fn().mockResolvedValue(false) })
    await user.type(title(), 'Keep me{Enter}')
    await waitFor(() => expect(screen.getByRole('button', { name: /add/i })).toBeEnabled())
    expect(title()).toHaveValue('Keep me')
  })

  it('prevents double submission while pending', async () => {
    let resolve!: (v: boolean) => void
    const onSubmit = vi.fn(() => new Promise<boolean>((r) => (resolve = r)))
    const { user } = setup({ compact: true, onSubmit })
    await user.type(title(), 'Once')
    await user.keyboard('{Enter}')
    await user.keyboard('{Enter}')
    await user.click(screen.getByRole('button', { name: /add/i }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    resolve(true)
    await waitFor(() => expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument())
  })

  it('regression: text typed while a previous add is saving is not wiped', async () => {
    let resolve!: (v: boolean) => void
    const onSubmit = vi.fn(() => new Promise<boolean>((r) => (resolve = r)))
    const { user } = setup({ compact: true, onSubmit })
    await user.type(title(), 'First{Enter}')
    expect(title()).toHaveValue('') // cleared immediately
    await user.type(title(), 'Second')
    resolve(true)
    await waitFor(() => expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument())
    expect(title()).toHaveValue('Second')
  })

  it('regression: a new task can be submitted while the previous one is still saving', async () => {
    const resolvers: ((v: boolean) => void)[] = []
    const onSubmit = vi.fn(() => new Promise<boolean>((r) => resolvers.push(r)))
    const { user } = setup({ compact: true, onSubmit })
    await user.type(title(), 'One{Enter}')
    await user.type(title(), 'Two{Enter}')
    expect(onSubmit.mock.calls.map((c) => (c as unknown as [{ title: string }])[0].title)).toEqual(['One', 'Two'])
    resolvers.forEach((r) => r(true))
    await waitFor(() => expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument())
  })

  it('does not restore failed text over something the user has started typing', async () => {
    let resolve!: (v: boolean) => void
    const { user } = setup({ compact: true, onSubmit: vi.fn(() => new Promise<boolean>((r) => (resolve = r))) })
    await user.type(title(), 'Failed one{Enter}')
    await user.type(title(), 'New draft')
    resolve(false)
    await waitFor(() => expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument())
    expect(title()).toHaveValue('New draft')
  })

  it('regression: two forms on one page have distinct, correctly associated fields', () => {
    const { container } = render(
      <>
        <TodoForm onSubmit={vi.fn()} />
        <TodoForm onSubmit={vi.fn()} initial={existing} />
      </>,
    )
    const dues = screen.getAllByLabelText('Due date')
    expect(dues).toHaveLength(2)
    expect(dues[0].id).not.toBe(dues[1].id)
    expect(dues[1]).toHaveValue('2026-06-15') // label → its own form's input
    const ids = Array.from(container.querySelectorAll('[id]')).map((el) => el.id)
    expect(ids).toHaveLength(8)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('enforces max lengths on inputs', () => {
    setup({ compact: false })
    expect(title()).toHaveAttribute('maxLength', '200')
    expect(screen.getByLabelText('Description')).toHaveAttribute('maxLength', '2000')
  })
})

describe('TodoForm (edit mode)', () => {
  it('pre-fills every field from the todo', () => {
    setup({ initial: existing, onCancel: vi.fn() })
    expect(title()).toHaveValue('Existing task')
    expect(title()).toHaveFocus()
    expect(screen.getByLabelText('Description')).toHaveValue('Some notes')
    expect(screen.getByLabelText('Priority')).toHaveValue('high')
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-06-15')
    expect(screen.getByLabelText('Tags')).toHaveValue('work, q2')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })

  it('submits edits and does not reset the form', async () => {
    const { user, onSubmit } = setup({ initial: existing })
    await user.clear(title())
    await user.type(title(), 'Renamed')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ title: 'Renamed', priority: 'high', tags: ['work', 'q2'] })
    await waitFor(() => expect(title()).toHaveValue('Renamed'))
  })

  it('clears the due date by sending null', async () => {
    const { user, onSubmit } = setup({ initial: existing })
    await user.clear(screen.getByLabelText('Due date'))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(onSubmit.mock.calls[0][0].dueDate).toBeNull()
  })

  it('keeps the original due date unchanged when saving untouched', async () => {
    const { user, onSubmit } = setup({ initial: existing })
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(onSubmit.mock.calls[0][0].dueDate).toBe(existing.dueDate)
  })

  it('Cancel calls onCancel without submitting', async () => {
    const onCancel = vi.fn()
    const { user, onSubmit } = setup({ initial: existing, onCancel })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
