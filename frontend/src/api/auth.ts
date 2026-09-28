import { api } from './client'
import type { ApiEnvelope, AuthResponse, ProfileInput, User } from '../types'

export const authApi = {
  async register(input: { name: string; email: string; password: string }) {
    const { data } = await api.post<ApiEnvelope<AuthResponse>>('/auth/register', input)
    return data.data
  },
  async login(input: { email: string; password: string }) {
    const { data } = await api.post<ApiEnvelope<AuthResponse>>('/auth/login', input)
    return data.data
  },
  async me() {
    const { data } = await api.get<ApiEnvelope<{ user: User }>>('/auth/me')
    return data.data.user
  },
  async updateProfile(input: ProfileInput) {
    const { data } = await api.patch<ApiEnvelope<{ user: User }>>('/auth/me', input)
    return data.data.user
  },
}
