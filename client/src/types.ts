export interface Org {
  id: string
  name: string
  subscription_status: 'trial' | 'active'
  trial_ends_at: string
}

export interface User {
  id: string
  display_name: string
  email: string
  avatar_url: string
  user_type: 'member' | 'external'
  timezone: string
  platform: string
  team_name: string
  today_minutes: number
  week_minutes: number
}

export interface UserDetail extends User {
  platform_user_id: string
  org_id: string
  created_at: string
}

export interface DayHours {
  date: string
  total_minutes: number
  display_name?: string
}

export interface Session {
  date: string
  start_time: string | null
  end_time: string | null
  duration_minutes: number
  status: string
}

export interface UserStats {
  totalMinutes: number
  activeDays: number
  avgPerActiveDay: number
  mostActiveDay: { date: string; minutes: number } | null
  daysRange: number
}

export interface Integration {
  id: string
  platform: string
  team_name: string
  team_id: string
}

export interface LeaveRequest {
  id: string
  display_name: string
  avatar_url: string
  leave_type: string
  start_date: string
  end_date: string
  status: 'pending' | 'approved' | 'rejected'
}

export interface Stats {
  totalUsers: number
  todayMinutes: number
  weekMinutes: number
}
