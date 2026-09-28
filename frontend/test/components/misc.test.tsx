import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatsBar } from '../../src/components/StatsBar'
import { EmptyState } from '../../src/components/EmptyState'
import { ConfirmDialog, Modal } from '../../src/components/Modal'
import { Navbar, ThemeToggle } from '../../src/components/Navbar'
import { Spinner } from '../../src/components/Spinner'
import { renderWithProviders, signInAs } from '../helpers/render'

describe('StatsBar', () => {
  const card = (label: string) => screen.getByText(label).closest('div')!.parentElement!

  it('shows each count and the completion percentage', () => {
    render(<StatsBar stats={{ total: 8, completed: 3, active: 5, overdue: 2 }} />)
    expect(card('Total')).toHaveTextContent('8')
    expect(card('Active')).toHaveTextContent('5')
    expect(card('Completed')).toHaveTextContent('3')
    expect(card('Overdue')).toHaveTextContent('2')
    expect(screen.getByText('38%')).toBeInTheDocument() // 3/8 = 37.5 → 38
  })

  it('shows 0% (not NaN) when there are no tasks', () => {
    render(<StatsBar stats={{ total: 0, completed: 0, active: 0, overdue: 0 }} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
  })

  it('caps the bar at 100%', () => {
    const { container } = render(<StatsBar stats={{ total: 4, completed: 4, active: 0, overdue: 0 }} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(container.querySelector('[style]')).toHaveStyle({ width: '100%' })
  })
})

describe('EmptyState', () => {
  it('renders title and message', () => {
    render(<EmptyState title="Nothing here" message="Add something" />)
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument()
    expect(screen.getByText('Add something')).toBeInTheDocument()
  })
})

describe('Spinner', () => {
  it('has an accessible label and accepts a className', () => {
    render(<Spinner className="size-9" />)
    expect(screen.getByLabelText('Loading')).toHaveClass('animate-spin', 'size-9')
  })
})

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} title="Hidden" onClose={vi.fn()}>
        body
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders an accessible dialog in a portal', () => {
    const { container } = render(
      <Modal open title="Edit task" onClose={vi.fn()}>
        <p>content</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Edit task' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(container).not.toContainElement(dialog) // portalled to body
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('closes via the X button, Escape key and backdrop', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Modal open title="T" onClose={onClose}>
        x
      </Modal>,
    )
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('dialog').firstElementChild as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('locks body scroll while open and restores it on close', () => {
    document.body.style.overflow = 'auto'
    const { rerender } = render(
      <Modal open title="T" onClose={vi.fn()}>
        x
      </Modal>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    rerender(
      <Modal open={false} title="T" onClose={vi.fn()}>
        x
      </Modal>,
    )
    expect(document.body.style.overflow).toBe('auto')
  })

  it('ignores other keys', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Modal open title="T" onClose={onClose}>
        x
      </Modal>,
    )
    await user.keyboard('a{Enter}')
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('ConfirmDialog', () => {
  it('confirms or cancels, focusing the destructive action', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmDialog open title="Delete task?" message="Gone forever" confirmLabel="Remove" onConfirm={onConfirm} onCancel={onCancel} />,
    )
    expect(screen.getByText('Gone forever')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('defaults the confirm label to Delete', () => {
    render(<ConfirmDialog open title="t" message="m" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})

describe('Navbar', () => {
  it('shows the signed-in user with initials and logs out', async () => {
    signInAs({ name: 'Ada Byron Lovelace', email: 'ada@example.com' })
    const { user } = renderWithProviders(<Navbar />)
    expect(await screen.findByText('Ada Byron Lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByText('AB')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }))
    await waitFor(() => expect(screen.queryByText('Ada Byron Lovelace')).not.toBeInTheDocument())
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('hides user controls when signed out', () => {
    renderWithProviders(<Navbar />)
    expect(screen.getByText('TaskFlow')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument()
  })

  it('ThemeToggle switches label and theme', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }))
    expect(document.documentElement).toHaveClass('dark')
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument()
  })
})
