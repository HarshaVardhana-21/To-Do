import { api } from './client'
import type { ApiEnvelope, Todo, TodoFilters, TodoInput, TodoStats } from '../types'

export const todosApi = {
  async list(filters: TodoFilters, signal?: AbortSignal) {
    const params: Record<string, string> = {
      status: filters.status,
      priority: filters.priority,
      sort: filters.sort,
      order: filters.order,
    }
    if (filters.search.trim()) params.search = filters.search.trim()
    const { data } = await api.get<ApiEnvelope<{ todos: Todo[] }>>('/todos', { params, signal })
    return data.data.todos
  },
  async stats() {
    const { data } = await api.get<ApiEnvelope<TodoStats>>('/todos/stats')
    return data.data
  },
  async create(input: TodoInput) {
    const { data } = await api.post<ApiEnvelope<{ todo: Todo }>>('/todos', input)
    return data.data.todo
  },
  async update(id: string, input: Partial<TodoInput>) {
    const { data } = await api.patch<ApiEnvelope<{ todo: Todo }>>(`/todos/${id}`, input)
    return data.data.todo
  },
  async remove(id: string) {
    await api.delete(`/todos/${id}`)
  },
  async clearCompleted() {
    const { data } = await api.delete<ApiEnvelope<{ deletedCount: number }>>('/todos/completed')
    return data.data.deletedCount
  },
}
