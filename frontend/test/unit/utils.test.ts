import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PRIORITY_STYLES,
  cn,
  formatDue,
  fromDateInput,
  initialsOf,
  isOverdue,
  parseTags,
  toDateInput,
} from '../../src/lib/utils'
import type { Todo } from '../../src/types'

const todo = (over: Partial<Todo> = {}): Todo => ({
  id: '1',
  title: 't',
  description: '',
  completed: false,
  completedAt: null,
  priority: 'medium',
  dueDate: null,
  tags: [],
  createdAt: '',
  updatedAt: '',
  ...over,
})

// Freeze "now" at Wed 2026-03-11 12:00 local time (only Date is faked).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 2, 11, 12, 0, 0))
})
afterEach(() => vi.useRealTimers())

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString()

describe('cn', () => {
  it('joins truthy class names only', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b')
    expect(cn()).toBe('')
  })
})

describe('PRIORITY_STYLES', () => {
  it('defines a label, badge and dot for every priority', () => {
    for (const p of ['low', 'medium', 'high'] as const) {
      expect(PRIORITY_STYLES[p].label).toBeTruthy()
      expect(PRIORITY_STYLES[p].badge).toBeTruthy()
      expect(PRIORITY_STYLES[p].dot).toMatch(/^bg-/)
    }
  })
})

describe('isOverdue', () => {
  it('is false without a due date', () => {
    expect(isOverdue(todo())).toBe(false)
  })

  it('is true once the due day has fully passed', () => {
    expect(isOverdue(todo({ dueDate: local(2026, 3, 10, 23, 59) }))).toBe(true)
    expect(isOverdue(todo({ dueDate: local(2025, 1, 1) }))).toBe(true)
  })

  it('is false for a task due today, even if the time has passed', () => {
    expect(isOverdue(todo({ dueDate: local(2026, 3, 11, 8, 0) }))).toBe(false)
    expect(isOverdue(todo({ dueDate: local(2026, 3, 11, 23, 59) }))).toBe(false)
  })

  it('is false for future dates', () => {
    expect(isOverdue(todo({ dueDate: local(2026, 3, 12) }))).toBe(false)
  })

  it('is never true for completed tasks', () => {
    expect(isOverdue(todo({ completed: true, dueDate: local(2020, 1, 1) }))).toBe(false)
  })
})

describe('formatDue', () => {
  it('says Today / Tomorrow for near dates', () => {
    expect(formatDue(local(2026, 3, 11, 23, 59))).toBe('Today')
    expect(formatDue(local(2026, 3, 12, 9))).toBe('Tomorrow')
  })

  it('formats other dates as "MMM d, yyyy"', () => {
    expect(formatDue(local(2026, 3, 10))).toBe('Mar 10, 2026')
    expect(formatDue(local(2027, 12, 25))).toBe('Dec 25, 2027')
  })
})

describe('date input conversion', () => {
  it('toDateInput renders the local calendar date', () => {
    expect(toDateInput(local(2026, 7, 4, 23, 59))).toBe('2026-07-04')
    expect(toDateInput(null)).toBe('')
  })

  it('fromDateInput returns the end of that local day as ISO', () => {
    const iso = fromDateInput('2026-07-04')!
    const d = new Date(iso)
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 6, 4, 23, 59])
  })

  it('fromDateInput returns null for an empty value', () => {
    expect(fromDateInput('')).toBeNull()
  })

  it('round-trips without shifting the day', () => {
    for (const v of ['2026-01-01', '2026-03-29', '2026-10-25', '2026-12-31', '2028-02-29']) {
      expect(toDateInput(fromDateInput(v))).toBe(v)
    }
  })
})

describe('parseTags', () => {
  it('splits, trims, lowercases and removes blanks', () => {
    expect(parseTags(' Work, home ,, ,URGENT ')).toEqual(['work', 'home', 'urgent'])
  })

  it('removes duplicates (case-insensitive)', () => {
    expect(parseTags('a, A, b, a')).toEqual(['a', 'b'])
  })

  it('caps at 10 tags (backend limit)', () => {
    expect(parseTags(Array.from({ length: 15 }, (_, i) => `t${i}`).join(','))).toHaveLength(10)
  })

  it('returns [] for empty input', () => {
    expect(parseTags('')).toEqual([])
    expect(parseTags(' , , ')).toEqual([])
  })
})

describe('initialsOf', () => {
  it('takes up to two initials, uppercased, ignoring extra whitespace', () => {
    expect(initialsOf('Ada Byron Lovelace')).toBe('AB')
    expect(initialsOf('  grace   hopper ')).toBe('GH')
    expect(initialsOf('Cher')).toBe('C')
  })
})
