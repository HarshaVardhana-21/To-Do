import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { RefreshCw, Trash2 } from 'lucide-react'
import { Navbar } from '../components/Navbar'
import { StatsBar } from '../components/StatsBar'
import { TodoForm } from '../components/TodoForm'
import { TodoFilters } from '../components/TodoFilters'
import { TodoList, TodoListSkeleton } from '../components/TodoList'
import { EmptyState } from '../components/EmptyState'
import { ConfirmDialog, Modal } from '../components/Modal'
import { useAuth } from '../hooks/useAuth'
import { useDebounce } from '../hooks/useDebounce'
import { useTodos } from '../hooks/useTodos'
import type { Todo, TodoFilters as Filters } from '../types'

const FILTERS_KEY = 'todoFilters'
const DEFAULT_FILTERS: Filters = { status: 'all', priority: 'all', search: '', sort: 'createdAt', order: 'desc' }

const ALLOWED: { [K in Exclude<keyof Filters, 'search'>]: readonly Filters[K][] } = {
  status: ['all', 'active', 'completed'],
  priority: ['all', 'low', 'medium', 'high'],
  sort: ['createdAt', 'dueDate', 'priority', 'title'],
  order: ['asc', 'desc'],
}

/** Restores saved filters, dropping any value the API would reject (stale or tampered storage). */
function loadFilters(): Filters {
  const filters = { ...DEFAULT_FILTERS }
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(FILTERS_KEY) ?? '{}')
    if (!saved || typeof saved !== 'object') return filters
    for (const key of Object.keys(ALLOWED) as (keyof typeof ALLOWED)[]) {
      const value = (saved as Record<string, unknown>)[key]
      if ((ALLOWED[key] as readonly unknown[]).includes(value)) {
        ;(filters as Record<string, unknown>)[key] = value
      }
    }
  } catch {
    /* unreadable storage: use defaults */
  }
  return filters
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [baseFilters, setBaseFilters] = useState<Omit<Filters, 'search'>>(loadFilters)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput, 300)
  const filters: Filters = { ...baseFilters, search }

  const { todos, stats, isLoading, error, retry, createTodo, updateTodo, toggleTodo, deleteTodo, clearCompleted } =
    useTodos(filters)

  const [editing, setEditing] = useState<Todo | null>(null)
  const [deleting, setDeleting] = useState<Todo | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(baseFilters))
    } catch {
      /* storage unavailable */
    }
  }, [baseFilters])

  const patchFilters = useCallback((patch: Partial<Filters>) => {
    const { search: _ignored, ...rest } = patch
    setBaseFilters((f) => ({ ...f, ...rest }))
  }, [])

  const closeEdit = useCallback(() => setEditing(null), [])
  const isFiltered = filters.status !== 'all' || filters.priority !== 'all' || Boolean(filters.search)

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{format(new Date(), 'EEEE, MMMM d')}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}, {user?.name.split(' ')[0]}
          </h1>
        </div>

        <StatsBar stats={stats} />

        <section className="card p-4">
          <TodoForm compact onSubmit={createTodo} />
        </section>

        <section className="space-y-4">
          <TodoFilters
            filters={filters}
            searchInput={searchInput}
            onSearchInput={setSearchInput}
            onChange={patchFilters}
          />

          {error ? (
            <div className="card flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button type="button" className="btn-secondary" onClick={retry}>
                <RefreshCw className="size-4" /> Try again
              </button>
            </div>
          ) : isLoading && todos.length === 0 ? (
            <TodoListSkeleton />
          ) : todos.length === 0 ? (
            isFiltered ? (
              <EmptyState title="No matching tasks" message="Try a different search or clear your filters." />
            ) : (
              <EmptyState title="You're all caught up" message="Add your first task above to get started." />
            )
          ) : (
            <TodoList todos={todos} onToggle={toggleTodo} onEdit={setEditing} onDelete={setDeleting} />
          )}

          {stats.completed > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                className="btn-ghost text-sm hover:text-red-600 dark:hover:text-red-400"
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 className="size-4" /> Clear completed ({stats.completed})
              </button>
            </div>
          )}
        </section>
      </main>

      <Modal open={editing !== null} title="Edit task" onClose={closeEdit}>
        {editing && (
          <TodoForm
            key={editing.id}
            initial={editing}
            onCancel={closeEdit}
            onSubmit={async (input) => {
              const ok = await updateTodo(editing.id, input)
              if (ok) closeEdit()
              return ok
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete task?"
        message={`"${deleting?.title ?? ''}" will be permanently deleted.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void deleteTodo(deleting.id)
          setDeleting(null)
        }}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Clear completed tasks?"
        message={`This will permanently delete ${stats.completed} completed task${stats.completed === 1 ? '' : 's'}.`}
        confirmLabel="Clear"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          void clearCompleted()
          setConfirmClear(false)
        }}
      />
    </div>
  )
}
