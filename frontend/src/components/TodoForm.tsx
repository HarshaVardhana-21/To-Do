import { useId, useRef, useState, type FormEvent } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import type { Priority, Todo, TodoInput } from '../types'
import { cn, fromDateInput, parseTags, toDateInput } from '../lib/utils'
import { Spinner } from './Spinner'

interface TodoFormProps {
  initial?: Todo
  /** Resolve to true on success so the form can reset/close. */
  onSubmit: (input: TodoInput) => Promise<boolean>
  onCancel?: () => void
  /** Compact mode shows only the title until expanded (used for "add"). */
  compact?: boolean
}

export function TodoForm({ initial, onSubmit, onCancel, compact = false }: TodoFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState(toDateInput(initial?.dueDate ?? null))
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '')
  const [expanded, setExpanded] = useState(!compact)
  const [pending, setPending] = useState(0)
  const submitting = pending > 0
  // Unique per form instance: the quick-add form and the edit modal are on screen together.
  const id = useId()
  const titleRef = useRef(title)
  const updateTitle = (v: string) => {
    titleRef.current = v
    setTitle(v)
  }

  const fill = (v: { title: string; description: string; priority: Priority; dueDate: string; tags: string }) => {
    updateTitle(v.title)
    setDescription(v.description)
    setPriority(v.priority)
    setDueDate(v.dueDate)
    setTags(v.tags)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // Edit mode submits once; add mode clears immediately, so the user can keep adding.
    if (!title.trim() || (initial && submitting)) return
    const snapshot = { title, description, priority, dueDate, tags }
    if (!initial) fill({ title: '', description: '', priority: 'medium', dueDate: '', tags: '' })

    setPending((n) => n + 1)
    const ok = await onSubmit({
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: fromDateInput(dueDate),
      tags: parseTags(tags),
    })
    setPending((n) => n - 1)

    // On failure, give the text back unless the user has already started typing a new task.
    if (!ok && !initial && titleRef.current === '') fill(snapshot)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <input
          className="input text-[0.9375rem] placeholder:font-display placeholder:italic"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => updateTitle(e.target.value)}
          maxLength={200}
          autoFocus={Boolean(initial)}
          aria-label="Title"
        />
        {compact && (
          <>
            <button
              type="button"
              className="btn-secondary shrink-0 px-3"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              title="More options"
            >
              <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
            </button>
            <button type="submit" className="btn-primary shrink-0" disabled={!title.trim() || (Boolean(initial) && submitting)}>
              {submitting ? <Spinner /> : <Plus className="size-4" />}
              <span className="hidden sm:inline">Add</span>
            </button>
          </>
        )}
      </div>

      {expanded && (
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor={`${id}-desc`}>Description</label>
            <textarea
              id={`${id}-desc`}
              className="input min-h-20 resize-y"
              placeholder="Add some details (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor={`${id}-priority`}>Priority</label>
              <select
                id={`${id}-priority`}
                className="input"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor={`${id}-due`}>Due date</label>
              <input
                id={`${id}-due`}
                type="date"
                className="input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor={`${id}-tags`}>Tags</label>
              <input
                id={`${id}-tags`}
                className="input"
                placeholder="work, home"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {!compact && (
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={!title.trim() || (Boolean(initial) && submitting)}>
            {submitting && <Spinner />}
            {initial ? 'Save changes' : 'Add task'}
          </button>
        </div>
      )}
    </form>
  )
}
