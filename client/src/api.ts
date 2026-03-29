import type { Org, User, UserDetail, DayHours, Session, UserStats, Integration, LeaveRequest, Stats } from './types'

export interface HeatmapCell {
  date: string
  hour: number
  minutes: number
  pct: number
}

const token = () => localStorage.getItem('st_token') || ''
const H = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() })

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...opts, headers: { ...H(), ...(opts?.headers || {}) } })
  if (r.status === 401) { localStorage.removeItem('st_token'); window.location.href = '/'; }
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export const api = {
  login: (email: string, password: string) => req<{ token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) => req<{ token: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  me: () => req<Org>('/api/auth/me'),
  stats: () => req<Stats>('/api/dashboard/stats'),
  users: () => req<User[]>('/api/dashboard/users'),
  presence: () => req<Record<string, string>>('/api/dashboard/presence'),
  hours: (days: number) => req<DayHours[]>('/api/dashboard/hours?days=' + days),
  integrations: () => req<Integration[]>('/api/dashboard/integrations'),
  leave: () => req<LeaveRequest[]>('/api/dashboard/leave'),
  updateLeave: (id: string, status: string) => req('/api/dashboard/leave/' + id, { method: 'PATCH', body: JSON.stringify({ status }) }),
  user: (id: string) => req<UserDetail>('/api/dashboard/users/' + id),
  userHours: (id: string, days: number) => req<DayHours[]>(`/api/dashboard/users/${id}/hours?days=${days}`),
  userHeatmap: (id: string, days: number) => req<HeatmapCell[]>(`/api/dashboard/users/${id}/heatmap?days=${days}`),
  userSessions: (id: string, days: number) => req<Session[]>(`/api/dashboard/users/${id}/sessions?days=${days}`),
  userStats: (id: string, days: number) => req<UserStats>(`/api/dashboard/users/${id}/stats?days=${days}`),
  userPresence: (id: string) => req<{ status: string }>('/api/dashboard/users/' + id + '/presence'),
  slackInstall: () => req<{ url: string }>('/api/slack/install'),
  slackSync: () => req<{ success: boolean; synced: number; breakdown: Record<string, number> }>('/api/slack/sync', { method: 'POST' }),
  billingCheckout: () => req<{ url: string }>('/api/billing/checkout', { method: 'POST' }),
  billingPortal: () => req<{ url: string }>('/api/billing/portal', { method: 'POST' }),
}