import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search, X } from 'lucide-react'
import type { Priority, SortField, StatusFilter, TodoFilters as Filters } from '../types'
import { cn } from '../lib/utils'

interface TodoFiltersProps {
  filters: Filters
  searchInput: string
  onSearchInput: (value: string) => void
  onChange: (patch: Partial<Filters>) => void
}

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
]

export function TodoFilters({ filters, searchInput, onSearchInput, onChange }: TodoFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-900" role="tablist">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={filters.status === tab.value}
              onClick={() => onChange({ status: tab.value })}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition sm:flex-none',
                filters.status === tab.value
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 pr-8"
            placeholder="Search tasks..."
            value={searchInput}
            onChange={(e) => onSearchInput(e.target.value)}
            aria-label="Search tasks"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => onSearchInput('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          className="input w-auto py-1.5"
          value={filters.priority}
          onChange={(e) => onChange({ priority: e.target.value as Priority | 'all' })}
          aria-label="Filter by priority"
        >
          <option value="all">All priorities</option>
          <option value="high">High priority</option>
          <option value="medium">Medium priority</option>
          <option value="low">Low priority</option>
        </select>
        <select
          className="input w-auto py-1.5"
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value as SortField })}
          aria-label="Sort by"
        >
          <option value="createdAt">Date created</option>
          <option value="dueDate">Due date</option>
          <option value="priority">Priority</option>
          <option value="title">Title</option>
        </select>
        <button
          type="button"
          className="btn-secondary px-2.5 py-1.5"
          onClick={() => onChange({ order: filters.order === 'asc' ? 'desc' : 'asc' })}
          title={filters.order === 'asc' ? 'Ascending' : 'Descending'}
          aria-label={`Sort order: ${filters.order === 'asc' ? 'ascending' : 'descending'}`}
        >
          {filters.order === 'asc' ? (
            <ArrowUpNarrowWide className="size-4" />
          ) : (
            <ArrowDownWideNarrow className="size-4" />
          )}
        </button>
      </div>
    </div>
  )
}
