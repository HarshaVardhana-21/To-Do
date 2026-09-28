import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { todosApi } from '../api/todos'
import { getErrorMessage } from '../api/client'
import type { Todo, TodoFilters, TodoInput, TodoStats } from '../types'

const EMPTY_STATS: TodoStats = { total: 0, completed: 0, active: 0, overdue: 0 }

/** Would this todo still show up in the list under the current filters? */
function matchesFilters(todo: Todo, f: TodoFilters) {
  if (f.status === 'active' && todo.completed) return false
  if (f.status === 'completed' && !todo.completed) return false
  if (f.priority !== 'all' && todo.priority !== f.priority) return false
  return true
}

export function useTodos(filters: TodoFilters) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [stats, setStats] = useState<TodoStats>(EMPTY_STATS)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const filtersRef = useRef(filters)
  useLayoutEffect(() => {
    filtersRef.current = filters
  })

  const refreshStats = useCallback(async () => {
    try {
      setStats(await todosApi.stats())
    } catch {
      /* stats are non-critical */
    }
  }, [])

  const fetchTodos = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    setError(null)
    try {
      setTodos(await todosApi.list(filtersRef.current, signal))
    } catch (err) {
      if (axios.isCancel(err)) return
      setError(getErrorMessage(err, 'Failed to load todos'))
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [])

  const { status, priority, search, sort, order } = filters
  useEffect(() => {
    const controller = new AbortController()
    void fetchTodos(controller.signal)
    return () => controller.abort()
  }, [fetchTodos, status, priority, search, sort, order])

  useEffect(() => {
    void refreshStats()
  }, [refreshStats])

  const createTodo = useCallback(
    async (input: TodoInput) => {
      try {
        await todosApi.create(input)
        toast.success('Task added')
        // Refetch so the new item lands in the right place for the active sort.
        await Promise.all([fetchTodos(), refreshStats()])
        return true
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to add task'))
        return false
      }
    },
    [fetchTodos, refreshStats],
  )

  const updateTodo = useCallback(
    async (id: string, input: Partial<TodoInput>, { silent = false } = {}) => {
      const previous = todos
      // Optimistic update.
      setTodos((list) =>
        list
          .map((t) => (t.id === id ? ({ ...t, ...input } as Todo) : t))
          .filter((t) => matchesFilters(t, filtersRef.current)),
      )
      try {
        const updated = await todosApi.update(id, input)
        setTodos((list) => list.map((t) => (t.id === id ? updated : t)))
        if (!silent) toast.success('Task updated')
        void refreshStats()
        return true
      } catch (err) {
        setTodos(previous)
        toast.error(getErrorMessage(err, 'Failed to update task'))
        return false
      }
    },
    [todos, refreshStats],
  )

  const toggleTodo = useCallback(
    (todo: Todo) => updateTodo(todo.id, { completed: !todo.completed }, { silent: true }),
    [updateTodo],
  )

  const deleteTodo = useCallback(
    async (id: string) => {
      const previous = todos
      setTodos((list) => list.filter((t) => t.id !== id))
      try {
        await todosApi.remove(id)
        toast.success('Task deleted')
        void refreshStats()
      } catch (err) {
        setTodos(previous)
        toast.error(getErrorMessage(err, 'Failed to delete task'))
      }
    },
    [todos, refreshStats],
  )

  const clearCompleted = useCallback(async () => {
    try {
      const count = await todosApi.clearCompleted()
      toast.success(count ? `Cleared ${count} completed task${count === 1 ? '' : 's'}` : 'Nothing to clear')
      await Promise.all([fetchTodos(), refreshStats()])
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to clear completed tasks'))
    }
  }, [fetchTodos, refreshStats])

  return {
    todos,
    stats,
    isLoading,
    error,
    retry: () => fetchTodos(),
    createTodo,
    updateTodo,
    toggleTodo,
    deleteTodo,
    clearCompleted,
  }
}
