import { memo } from 'react'
import { Calendar, Check, Pencil, Trash2 } from 'lucide-react'
import type { Todo } from '../types'
import { PRIORITY_STYLES, cn, formatDue, isOverdue } from '../lib/utils'

interface TodoItemProps {
  todo: Todo
  onToggle: (todo: Todo) => void
  onEdit: (todo: Todo) => void
  onDelete: (todo: Todo) => void
}

export const TodoItem = memo(function TodoItem({ todo, onToggle, onEdit, onDelete }: TodoItemProps) {
  const overdue = isOverdue(todo)
  const p = PRIORITY_STYLES[todo.priority]

  return (
    <li
      className={cn(
        'group card flex items-start gap-3 p-4 transition hover:shadow-md',
        overdue && 'border-red-300 dark:border-red-500/40',
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(todo)}
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition',
          todo.completed
            ? 'border-brand-600 bg-brand-600 text-white'
            : 'border-slate-300 hover:border-brand-500 dark:border-slate-600',
        )}
        aria-label={todo.completed ? 'Mark as not done' : 'Mark as done'}
        aria-pressed={todo.completed}
      >
        {todo.completed && <Check className="size-3" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'break-words font-medium',
            todo.completed && 'text-slate-400 line-through dark:text-slate-500',
          )}
        >
          {todo.title}
        </p>
        {todo.description && (
          <p
            className={cn(
              'mt-1 whitespace-pre-line break-words text-sm text-slate-600 dark:text-slate-400',
              todo.completed && 'opacity-60',
            )}
          >
            {todo.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1 ring-inset', p.badge)}>
            <span className={cn('size-1.5 rounded-full', p.dot)} />
            {p.label}
          </span>
          {todo.dueDate && (
            <span
              className={cn(
                'inline-flex items-center gap-1',
                overdue ? 'font-medium text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400',
              )}
            >
              <Calendar className="size-3.5" />
              {overdue ? 'Overdue · ' : ''}
              {formatDue(todo.dueDate)}
            </span>
          )}
          {todo.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 gap-1 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button type="button" className="btn-ghost" onClick={() => onEdit(todo)} aria-label="Edit task" title="Edit">
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          className="btn-ghost hover:text-red-600 dark:hover:text-red-400"
          onClick={() => onDelete(todo)}
          aria-label="Delete task"
          title="Delete"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  )
})
