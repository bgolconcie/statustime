import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import type { UserDetail as IUserDetail, DayHours, Session, UserStats } from '../types'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { StatusDot, StatusDotLoading } from '../components/ui/StatusDot'
import { StatCard } from '../components/ui/StatCard'
import { Card, CardHeader } from '../components/ui/Card'
import { useLocalTime } from '../hooks/useLocalTime'
import { useTheme } from '../hooks/useTheme'
import { minsToHours, formatDate } from '../utils'

interface HourSlot { hour: number; pct: number; active: number; total: number }

function HourlyHeatmap({ data, days }: { data: HourSlot[]; days: number }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [tooltip, setTooltip] = useState<{ hour: number; pct: number; active: number; total: number; x: number; y: number } | null>(null)

  // 13 discrete levels: 0/12 ... 12/12
  // Map pct to one of 13 buckets (0=empty, 1-12=intensity)
  const getLevel = (pct: number): number => {
    if (pct === 0) return 0
    return Math.max(1, Math.min(12, Math.round(pct / 100 * 12)))
  }

  const getCellBg = (level: number): string => {
    if (level === 0) return isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'
    const r = level / 12
    return isDark
      ? `rgba(${Math.round(20 + r * 36)},${Math.round(40 + r * 149)},${Math.round(80 + r * 168)},${(0.2 + r * 0.8).toFixed(2)})`
      : `rgb(${Math.round(219 - r * 182)},${Math.round(234 - r * 135)},${Math.round(254 - r * 19)})`
  }

  const amPm = (h: number) => {
    if (h === 0) return '12a'
    if (h === 12) return '12p'
    return h < 12 ? `${h}a` : `${h - 12}p`
  }

  const filled = data.length === 24 ? data : Array.from({ length: 24 }, (_, i) => ({ hour: i, pct: 0, active: 0, total: 0 }))
  const hasData = filled.some(s => s.total > 0)

  return (
    <div style={{ position: 'relative' }}>
      {/* Hour labels row */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
        {filled.map(slot => (
          <div key={slot.hour} style={{ flex: 1, textAlign: 'center', fontSize: '0.6rem', color: 'var(--muted)', lineHeight: 1 }}>
            {slot.hour % 3 === 0 ? amPm(slot.hour) : ''}
          </div>
        ))}
      </div>

      {/* Heatmap cells row */}
      <div style={{ display: 'flex', gap: 3 }}>
        {filled.map(slot => {
          const level = getLevel(slot.pct)
          return (
            <div
              key={slot.hour}
              onMouseEnter={e => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                const parent = (e.currentTarget as HTMLElement).closest('[data-heatmap]')!.getBoundingClientRect()
                setTooltip({ ...slot, x: rect.left - parent.left + rect.width / 2, y: rect.top - parent.top })
              }}
              onMouseLeave={() => setTooltip(null)}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 5,
                background: getCellBg(level),
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
                cursor: slot.total > 0 ? 'default' : 'default',
                transition: 'transform 0.1s',
              }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = 'scaleY(1.12)' }}
              onFocus={() => {}}
              onBlur={() => setTooltip(null)}
            />
          )
        })}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          top: tooltip.y - 68,
          left: Math.max(0, tooltip.x - 54),
          background: isDark ? '#1e293b' : '#fff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
          borderRadius: 8,
          padding: '0.45rem 0.7rem',
          fontSize: '0.75rem',
          pointerEvents: 'none',
          zIndex: 50,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{amPm(tooltip.hour)} &mdash; {amPm(tooltip.hour + 1 > 23 ? 0 : tooltip.hour + 1)}</div>
          <div style={{ color: 'var(--accent)', fontWeight: 600 }}>{tooltip.pct.toFixed(1)}% active</div>
          <div style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>{tooltip.active} / {tooltip.total} polls</div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: '0.7rem', color: 'var(--muted)' }}>
        <span>0%</span>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(l => (
          <div key={l} style={{
            width: 14, height: 14, borderRadius: 3,
            background: getCellBg(l),
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
          }} />
        ))}
        <span>100%</span>
        <span style={{ marginLeft: 'auto', opacity: 0.55, fontSize: '0.65rem' }}>
          {hasData ? `5-min polls over last ${days} days` : 'Waiting for first poll data...'}
        </span>
      </div>
    </div>
  )
}

export function UserDetail() {
  const { id } = useParams<{ id: string }>()
  const [user, setUser] = useState<IUserDetail | null>(null)
  const [presence, setPresence] = useState<string | null>(null)
  const [hours, setHours] = useState<DayHours[]>([])
  const [hourly, setHourly] = useState<HourSlot[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [todayMins, setTodayMins] = useState(0)
  const [weekMins, setWeekMins] = useState(0)
  const [chartDays, setChartDays] = useState(5)
  const [heatmapDays, setHeatmapDays] = useState(30)
  const [logDays, setLogDays] = useState(14)
  const { theme } = useTheme()
  const { time, date } = useLocalTime(user?.timezone || '')

  useEffect(() => {
    if (!id) return
    api.user(id).then(setUser).catch(() => {})
    api.userPresence(id).then(d => setPresence(d.status)).catch(() => {})
    api.users().then(us => {
      const u = us.find(u => u.id === id)
      if (u) { setTodayMins(u.today_minutes); setWeekMins(u.week_minutes) }
    }).catch(() => {})
    api.userStats(id, 30).then(setStats).catch(() => {})
    const tid = setInterval(() => api.userPresence(id).then(d => setPresence(d.status)).catch(() => {}), 60000)
    return () => clearInterval(tid)
  }, [id])

  useEffect(() => {
    if (id) api.userHours(id, chartDays).then(setHours).catch(() => {})
  }, [id, chartDays])

  useEffect(() => {
    if (!id) return
    fetch(`/api/dashboard/users/${id}/hourly?days=${heatmapDays}`, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('st_token') }
    }).then(r => r.json()).then(d => { if (Array.isArray(d)) setHourly(d) }).catch(() => {})
  }, [id, heatmapDays])

  useEffect(() => {
    if (id) api.userSessions(id, logDays).then(setSessions).catch(() => {})
  }, [id, logDays])

  const chartData = (() => {
    const hoursMap: Record<string, number> = {}
    hours.forEach(h => { hoursMap[String(h.date).split('T')[0]] = h.total_minutes })
    const result = []
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date()
      d.setUTCHours(0, 0, 0, 0)
      d.setUTCDate(d.getUTCDate() - i)
      const ds = d.toISOString().split('T')[0]
      result.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        hours: Math.round((hoursMap[ds] || 0) / 6) / 10
      })
    }
    return result
  })()

  const isDark = theme === 'dark'
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const labelColor = isDark ? '#64748b' : '#94a3b8'
  const sel: React.CSSProperties = {
    background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--text)', padding: '0.3rem 0.6rem', fontSize: '0.775rem',
    outline: 'none', fontFamily: 'inherit'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 2rem', height: 56, display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 100, boxShadow: 'var(--shadow)' }}>
        <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--muted)', fontSize: '0.875rem', padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)' }}>
          Back
        </Link>
        <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent)' }}>
          Status<span style={{ color: 'var(--text)' }}>Time</span>
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '2rem', display: 'flex', alignItems: 'flex-start', gap: '1.5rem', marginBottom: '1.5rem', boxShadow: 'var(--shadow)', flexWrap: 'wrap' }}>
          <Avatar name={user?.display_name || '?'} url={user?.avatar_url} size={72} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: 'Syne,sans-serif', fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              {user?.display_name || 'Loading...'}
              {user && <Badge variant={user.user_type}>{user.user_type === 'external' ? 'External' : 'Member'}</Badge>}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.2rem' }}>{user?.email}</div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              {user && <>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Team: <strong style={{ color: 'var(--text)' }}>{user.team_name}</strong></span>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>TZ: <strong style={{ color: 'var(--text)' }}>{user.timezone?.replace(/_/g, ' ')}</strong></span>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Joined: <strong style={{ color: 'var(--text)' }}>{user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}</strong></span>
              </>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
            {presence === null ? <StatusDotLoading /> : <StatusDot status={presence} />}
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 1rem', textAlign: 'right' }}>
              <div style={{ fontFamily: 'Syne,sans-serif', fontSize: '1.4rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{time || '--:--'}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{user?.timezone?.split('/').pop()?.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{date}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="Today" value={todayMins ? minsToHours(todayMins) : '--'} sub="hours active" color="var(--green)" />
          <StatCard label="This week" value={weekMins ? minsToHours(weekMins) : '--'} sub="last 7 days" color="var(--accent)" />
          <StatCard label="This month" value={stats?.totalMinutes ? minsToHours(stats.totalMinutes) : '--'} sub="last 30 days" color="var(--accent2)" />
          <StatCard label="Avg / active day" value={stats?.avgPerActiveDay ? minsToHours(stats.avgPerActiveDay) : '--'} sub="active days only" color="var(--yellow)" />
          <StatCard label="Active days" value={stats?.activeDays ?? '--'} sub="in last 30 days" />
        </div>
        <Card>
          <CardHeader title="Daily Active Hours" right={
            <select value={chartDays} onChange={e => setChartDays(Number(e.target.value))} style={sel}>
              <option value={5}>Last 5 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
            </select>
          } />
          <div style={{ padding: '1.5rem' }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" tick={{ fill: labelColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: labelColor, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v + 'h'} />
                <Tooltip formatter={(v: number) => [v + 'h', 'Active hours']}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.85rem' }} />
                <Bar dataKey="hours" fill="var(--accent)" radius={[4, 4, 0, 0]} fillOpacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Activity Heatmap by Hour" right={
            <select value={heatmapDays} onChange={e => setHeatmapDays(Number(e.target.value))} style={sel}>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
            </select>
          } />
          <div style={{ padding: '1.5rem' }} data-heatmap="1">
            <HourlyHeatmap data={hourly} days={heatmapDays} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Activity Log" right={
            <select value={logDays} onChange={e => setLogDays(Number(e.target.value))} style={sel}>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          } />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Date', 'Start', 'End', 'Duration', 'Status'].map(h => (
                <th key={h} style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', padding: '0.75rem 1.25rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {sessions.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>No sessions for this period</td></tr>
              )}
              {sessions.map((s, i) => (
                <tr key={i}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <td style={{ padding: '0.7rem 1.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', fontWeight: 600 }}>{formatDate(s.date)}</td>
                  <td style={{ padding: '0.7rem 1.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--muted)' }}>{s.start_time ? new Date(s.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--'}</td>
                  <td style={{ padding: '0.7rem 1.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--muted)' }}>{s.end_time ? new Date(s.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--'}</td>
                  <td style={{ padding: '0.7rem 1.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>{s.duration_minutes ? minsToHours(s.duration_minutes) : '--'}</td>
                  <td style={{ padding: '0.7rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 500 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.status === 'active' ? 'var(--green)' : 'var(--muted)' }} />
                      {s.status || '--'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}