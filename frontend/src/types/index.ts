export type Priority = 'low' | 'medium' | 'high'

export interface User {
  id: string
  name: string
  email: string
  about: string
  /** Base64 data URL, or null when the user has no picture. */
  avatar: string | null
  createdAt: string
  updatedAt: string
}

export interface ProfileInput {
  name?: string
  about?: string
  avatar?: string | null
}

export interface Todo {
  id: string
  title: string
  description: string
  completed: boolean
  completedAt: string | null
  priority: Priority
  dueDate: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface TodoInput {
  title: string
  description?: string
  priority?: Priority
  dueDate?: string | null
  tags?: string[]
  completed?: boolean
}

export type StatusFilter = 'all' | 'active' | 'completed'
export type SortField = 'createdAt' | 'dueDate' | 'priority' | 'title'

export interface TodoFilters {
  status: StatusFilter
  priority: Priority | 'all'
  search: string
  sort: SortField
  order: 'asc' | 'desc'
}

export interface TodoStats {
  total: number
  completed: number
  active: number
  overdue: number
}

export interface AuthResponse {
  user: User
  token: string
}

export interface ApiEnvelope<T> {
  success: boolean
  data: T
  message?: string
}
