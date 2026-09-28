import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodoFilters } from '../../src/components/TodoFilters'
import type { TodoFilters as Filters } from '../../src/types'

const DEFAULTS: Filters = { status: 'all', priority: 'all', search: '', sort: 'createdAt', order: 'desc' }

function setup(filters: Partial<Filters> = {}, searchInput = '') {
  const onChange = vi.fn()
  const onSearchInput = vi.fn()
  render(
    <TodoFilters
      filters={{ ...DEFAULTS, ...filters }}
      searchInput={searchInput}
      onSearchInput={onSearchInput}
      onChange={onChange}
    />,
  )
  return { onChange, onSearchInput, user: userEvent.setup() }
}

describe('TodoFilters', () => {
  it('marks the active status tab as selected', () => {
    setup({ status: 'active' })
    expect(screen.getByRole('tab', { name: 'Active' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'false')
  })

  it('changes status', async () => {
    const { user, onChange } = setup()
    await user.click(screen.getByRole('tab', { name: 'Completed' }))
    expect(onChange).toHaveBeenCalledWith({ status: 'completed' })
  })

  it('changes priority and sort', async () => {
    const { user, onChange } = setup()
    await user.selectOptions(screen.getByLabelText('Filter by priority'), 'high')
    expect(onChange).toHaveBeenCalledWith({ priority: 'high' })
    await user.selectOptions(screen.getByLabelText('Sort by'), 'dueDate')
    expect(onChange).toHaveBeenCalledWith({ sort: 'dueDate' })
  })

  it('offers every sort field the API supports', () => {
    setup()
    const values = Array.from(screen.getByLabelText<HTMLSelectElement>('Sort by').options).map((o) => o.value)
    expect(values).toEqual(['createdAt', 'dueDate', 'priority', 'title'])
  })

  it('toggles sort order and labels it for screen readers', async () => {
    const { user, onChange } = setup({ order: 'desc' })
    const btn = screen.getByRole('button', { name: 'Sort order: descending' })
    await user.click(btn)
    expect(onChange).toHaveBeenCalledWith({ order: 'asc' })
  })

  it('toggles from asc back to desc', async () => {
    const { user, onChange } = setup({ order: 'asc' })
    await user.click(screen.getByRole('button', { name: 'Sort order: ascending' }))
    expect(onChange).toHaveBeenCalledWith({ order: 'desc' })
  })

  it('reports search input and shows a clear button only when non-empty', async () => {
    const { user, onSearchInput } = setup()
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Search tasks' }), 'm')
    expect(onSearchInput).toHaveBeenCalledWith('m')
  })

  it('clears the search', async () => {
    const { user, onSearchInput } = setup({}, 'milk')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onSearchInput).toHaveBeenCalledWith('')
  })
})
