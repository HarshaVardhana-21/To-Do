import { format, isPast, isToday, isTomorrow, parseISO } from 'date-fns'
import type { Priority, Todo } from '../types'

export const cn = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(' ')

export const PRIORITY_STYLES: Record<Priority, { label: string; badge: string; dot: string }> = {
  low: {
    label: 'Low',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  medium: {
    label: 'Medium',
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  high: {
    label: 'High',
    badge: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400',
    dot: 'bg-red-500',
  },
}

/** A todo is overdue once its due day has fully passed. */
export function isOverdue(todo: Todo) {
  if (!todo.dueDate || todo.completed) return false
  const due = parseISO(todo.dueDate)
  return isPast(due) && !isToday(due)
}

export function formatDue(iso: string) {
  const d = parseISO(iso)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'MMM d, yyyy')
}

/** ISO string -> value for <input type="date"> (local date). */
export const toDateInput = (iso: string | null) => (iso ? format(parseISO(iso), 'yyyy-MM-dd') : '')

/** <input type="date"> value -> ISO string at end of that local day, or null. */
export function fromDateInput(value: string): string | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59).toISOString()
}

export const parseTags = (value: string) =>
  [...new Set(value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 10)

/** Up to two initials, e.g. "Ada Byron Lovelace" -> "AB". */
export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
