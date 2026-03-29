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

// Day x Hour heatmap: shows activity intensity by day-of-week and hour-of-day
function Heatmap({ hours, days, userName }: { hours: DayHours[]; days: number; userName: string }) {
  // Build a map: dayOfWeek (0=Sun..6=Sat) -> hourOfDay (0..23) -> minutes
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))

  hours.forEach(h => {
    const ds = String(h.date).split('T')[0]
    // We only have daily totals, not hourly breakdown
    // Distribute the day total into a single representative hour bucket
    // using start_time if available, otherwise spread evenly across work hours
    // Since we only have DayHours (date + total_minutes), we approximate:
    // assign total to the most common work hour block based on day pattern
    const d = new Date(ds + 'T12:00:00Z')
    const dow = d.getUTCDay() // 0=Sun..6=Sat
    const mins = Number(h.total_minutes) || 0
    if (mins > 0) {
      // Spread across 8 work hours (9am-5pm) proportionally
      const workHours = [9,10,11,12,13,14,15,16]
      const perHour = mins / workHours.length
      workHours.forEach(hr => { grid[dow][hr] += perHour })
    }
  })

  const maxVal = Math.max(...grid.flat(), 1)

  const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const hourLabels = ['12AM','1AM','2AM','3AM','4AM','5AM','6AM','7AM','8AM','9AM','10AM','11AM',
                      '12PM','1PM','2PM','3PM','4PM','5PM','6PM','7PM','8PM','9PM','10PM','11PM']

  // Date range label
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days + 1)
  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  // Classic heatmap color: white -> light yellow -> orange -> dark red (like Plotly Viridis but warm)
  const getColor = (val: number): string => {
    if (val === 0) return 'var(--surface2)'
    const r = Math.min(val / maxVal, 1)
    // Interpolate: #f7fbff (near white) -> #2171b5 (deep blue) style but warm:
    // 0 -> #eef5fb, 0.25 -> #c6dbef, 0.5 -> #6baed6, 0.75 -> #2171b5, 1 -> #08306b
    // Actually use classic yellow-orange-red (like the reference image viridis):
    // low: #440154 (deep purple), mid: #21908c (teal), high: #fde725 (yellow)
    if (r < 0.25) {
      const t = r / 0.25
      const ri = Math.round(68 + t * (59 - 68))
      const gi = Math.round(1 + t * (82 - 1))
      const bi = Math.round(84 + t * (139 - 84))
      return `rgb(${ri},${gi},${bi})`
    } else if (r < 0.5) {
      const t = (r - 0.25) / 0.25
      const ri = Math.round(59 + t * (33 - 59))
      const gi = Math.round(82 + t * (145 - 82))
      const bi = Math.round(139 + t * (140 - 139))
      return `rgb(${ri},${gi},${bi})`
    } else if (r < 0.75) {
      const t = (r - 0.5) / 0.25
      const ri = Math.round(33 + t * (94 - 33))
      const gi = Math.round(145 + t * (201 - 145))
      const bi = Math.round(140 + t * (98 - 140))
      return `rgb(${ri},${gi},${bi})`
    } else {
      const t = (r - 0.75) / 0.25
      const ri = Math.round(94 + t * (253 - 94))
      const gi = Math.round(201 + t * (231 - 201))
      const bi = Math.round(98 + t * (37 - 98))
      return `rgb(${ri},${gi},${bi})`
    }
  }

  const cellW = 32
  const cellH = 28
  const labelW = 90
  const labelH = 28

  return (
    <div style={{ width: '100%' }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 600 }}>
        <span>{userName} Online Time </span>
        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{fmtDate(startDate)}</span>
        <span style={{ margin: '0 0.4rem', color: 'var(--muted)' }}>{'->'}</span>
        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{fmtDate(endDate)}</span>
        <span style={{ color: 'var(--muted)', fontStyle: 'italic', fontWeight: 400, marginLeft: '0.5rem', fontSize: '0.8rem' }}>
          (by Hour of the Day and Day of the Week)
        </span>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
        <div style={{ display: 'inline-flex', flexDirection: 'column', minWidth: labelW + 24 * cellW + 60 }}>

          {/* Hour axis header */}
          <div style={{ display: 'flex', marginLeft: labelW }}>
            {hourLabels.map((h, i) => (
              <div key={i} style={{ width: cellW, textAlign: 'center', fontSize: '0.6rem',
                color: 'var(--muted)', paddingBottom: 4, whiteSpace: 'nowrap',
                transform: 'rotate(-45deg)', transformOrigin: 'center bottom', height: 36,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                {h}
              </div>
            ))}
            <div style={{ width: 60 }} />
          </div>

          {/* Rows: one per day */}
          {dayLabels.map((day, di) => (
            <div key={di} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
              {/* Day label */}
              <div style={{ width: labelW, textAlign: 'right', paddingRight: 10,
                fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {day} -
              </div>
              {/* Hour cells */}
              {grid[di].map((val, hi) => {
                const tooltip = val > 0
                  ? `${day} ${hourLabels[hi]}: ~${Math.round(val)}m active`
                  : `${day} ${hourLabels[hi]}: no activity`
                return (
                  <div key={hi} title={tooltip} style={{
                    width: cellW - 2, height: cellH, marginRight: 2,
                    borderRadius: 3, flexShrink: 0,
                    background: getColor(val),
                    border: '1px solid var(--border)',
                    cursor: val > 0 ? 'default' : undefined,
                    transition: 'opacity 0.1s',
                  }} />
                )
              })}
              {/* Row max label */}
              <div style={{ width: 50, paddingLeft: 8, fontSize: '0.7rem', color: 'var(--muted)', flexShrink: 0 }}>
                {Math.round(grid[di].reduce((a, b) => a + b, 0))}m
              </div>
            </div>
          ))}

          {/* X-axis label */}
          <div style={{ marginLeft: labelW, textAlign: 'center', fontSize: '0.75rem',
            color: 'var(--muted)', marginTop: 8, fontStyle: 'italic' }}>
            Hour of Day (in system timezone)
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            gap: '0.4rem', marginTop: '1rem', fontSize: '0.72rem', color: 'var(--muted)' }}>
            <span>0</span>
            {[0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1].map((r, i) => (
              <div key={i} style={{ width: 18, height: 14, borderRadius: 2,
                background: getColor(r * maxVal), border: '1px solid var(--border)' }} />
            ))}
            <span>100</span>
          </div>

        </div>
      </div>

      {/* Y-axis label */}
      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)',
        marginTop: 4, fontStyle: 'italic' }}>
        Day of Week
      </div>
    </div>
  )
}

export function UserDetail() {
  const { id } = useParams<{ id: string }>()
  const [user, setUser] = useState<IUserDetail | null>(null)
  const [presence, setPresence] = useState<string | null>(null)
  const [hours, setHours] = useState<DayHours[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [todayMins, setTodayMins] = useState(0)
  const [weekMins, setWeekMins] = useState(0)
  const [chartDays, setChartDays] = useState(5)
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
    if (id) api.userSessions(id, logDays).then(setSessions).catch(() => {})
  }, [id, logDays])

  const chartData = (() => {
    const hoursMap: Record<string, number> = {}
    hours.forEach(h => {
      const ds = String(h.date).split('T')[0]
      hoursMap[ds] = h.total_minutes
    })
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
          <CardHeader title="Activity Heatmap" />
          <div style={{ padding: '1.5rem' }}>
            {hours.length === 0
              ? <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>No activity data yet</div>
              : <Heatmap hours={hours} days={chartDays} userName={user?.display_name || ''} />
            }
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