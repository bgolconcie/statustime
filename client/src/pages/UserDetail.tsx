import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import type { User, UserDetail as IUserDetail, DayHours, UserStats } from '../types'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { StatusDot, StatusDotLoading } from '../components/ui/StatusDot'
import { StatCard } from '../components/ui/StatCard'
import { Card, CardHeader } from '../components/ui/Card'
import { minsToHours } from '../utils'

interface HourSlot { dow: number; hour: number; pct: number; active: number; total: number }
interface HourData { hour: number; active: number; away: number; total: number }
interface DayLog { date: string; dow: string; hours: HourData[]; active_polls: number; total_polls: number; active_minutes: number; pct: number; first_active: number | null; last_active: number | null }

function HourlyHeatmap({ data, days }: { data: HourSlot[]; days: number }) {
  const [tooltip, setTooltip] = useState<{ dow: number; hour: number; pct: number; active: number; total: number; x: number; y: number } | null>(null)
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h-12}p`)
  const getCellBg = (pct: number, hasPolls: boolean) => {
    if (!hasPolls) return 'rgb(226,232,240)'
    if (pct < 25)  return 'rgb(203,213,225)'
    if (pct < 40)  return 'rgb(239,68,68)'
    if (pct < 70)  return 'rgb(249,115,22)'
    return 'rgb(34,197,94)'
  }
  const grid = Array.from({ length: 7 }, (_, dow) =>
    Array.from({ length: 24 }, (_, h) => data.find(d => d.dow === dow && d.hour === h) || { dow, hour: h, pct: 0, active: 0, total: 0 })
  )
  const W = 36
  const LEGEND = [
    { label: '0%',      bg: 'rgb(226,232,240)' },
    { label: '< 25%',   bg: 'rgb(203,213,225)' },
    { label: '25–40%',  bg: 'rgb(239,68,68)'   },
    { label: '40–70%',  bg: 'rgb(249,115,22)'  },
    { label: '70–100%', bg: 'rgb(34,197,94)'   },
  ]
  return (
    <div style={{ position: 'relative', overflowX: 'auto' }}>
      {grid.map((row, dow) => (
        <div key={dow} style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
          <div style={{ width: W, flexShrink: 0, fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted)', textAlign: 'right', paddingRight: 8 }}>{DAY_NAMES[dow]}</div>
          <div style={{ display: 'flex', gap: 2 }}>
            {row.map(slot => (
              <div key={slot.hour}
                onMouseEnter={e => { const r=(e.currentTarget as HTMLElement).getBoundingClientRect();const p=(e.currentTarget as HTMLElement).closest('[data-heatmap]')!.getBoundingClientRect();setTooltip({...slot,x:r.left-p.left+r.width/2,y:r.top-p.top}) }}
                onMouseLeave={() => setTooltip(null)}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.filter='brightness(1.2)' }}
                style={{ width:28, height:22, borderRadius:4, flexShrink:0, background:getCellBg(slot.pct, slot.total > 0), border:'1px solid rgba(0,0,0,0.07)', cursor:'default', transition:'filter 0.1s' }}
              />
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', marginLeft: W, marginTop: 4, gap: 2 }}>
        {HOUR_LABELS.map((lbl, h) => (
          <div key={h} style={{ width: 28, flexShrink: 0, textAlign: 'center', fontSize: '0.6rem', color: 'var(--muted)' }}>{lbl}</div>
        ))}
      </div>
      {tooltip && (
        <div style={{ position:'absolute', top:tooltip.y-72, left:Math.max(0,tooltip.x-60), background:'#fff', border:'1px solid rgba(0,0,0,0.12)', borderRadius:8, padding:'0.45rem 0.75rem', fontSize:'0.75rem', pointerEvents:'none', zIndex:50, whiteSpace:'nowrap', boxShadow:'0 4px 12px rgba(0,0,0,0.15)', lineHeight:1.7 }}>
          <div style={{ fontWeight:700 }}>{DAY_NAMES[tooltip.dow]} {HOUR_LABELS[tooltip.hour]}</div>
          <div style={{ color:'var(--accent)', fontWeight:600 }}>{tooltip.pct.toFixed(1)}% active</div>
          <div style={{ color:'var(--muted)', fontSize:'0.7rem' }}>{tooltip.active} / {tooltip.total} polls</div>
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginTop:10, fontSize:'0.7rem', color:'var(--muted)', marginLeft:W }}>
        {LEGEND.map(({ label, bg }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:13, height:13, borderRadius:3, background:bg, border:'1px solid rgba(0,0,0,0.07)', flexShrink:0 }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DayTimeline({ day }: { day: DayLog }) {
  const dateObj = new Date(day.date + 'T12:00:00Z')
  const dateLabel = dateObj.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', timeZone:'UTC' })
  const awayPolls = day.total_polls - day.active_polls
  const fmtMins = (m: number) => {
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60), rem = m % 60
    return rem ? `${h}h ${rem}m` : `${h}h`
  }
  return (
    <tr>
      <td style={{ padding:'0.75rem 1.25rem', borderBottom:'1px solid var(--border)', fontSize:'0.875rem', fontWeight:500 }}>{dateLabel}</td>
      <td style={{ padding:'0.75rem 1.25rem', borderBottom:'1px solid var(--border)', fontSize:'0.875rem', color:'#22c55e', fontWeight:600 }}>{day.active_polls} <span style={{ fontSize:'0.75rem', color:'var(--muted)', fontWeight:400 }}>({fmtMins(day.active_minutes)})</span></td>
      <td style={{ padding:'0.75rem 1.25rem', borderBottom:'1px solid var(--border)', fontSize:'0.875rem', color:'#94a3b8' }}>{awayPolls}</td>
      <td style={{ padding:'0.75rem 1.25rem', borderBottom:'1px solid var(--border)', fontSize:'0.875rem', color:'var(--muted)' }}>{day.total_polls}</td>
    </tr>
  )
}

export function UserDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<IUserDetail | null>(null)
  const [presence, setPresence] = useState<string | null>(null)
  const [hours, setHours] = useState<DayHours[]>([])
  const [hourly, setHourly] = useState<HourSlot[]>([])
  const [activityLog, setActivityLog] = useState<DayLog[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [todayMins, setTodayMins] = useState(0)
  const [weekMins, setWeekMins] = useState(0)
  const [chartDays, setChartDays] = useState(5)
  const [heatmapDays, setHeatmapDays] = useState(7)
  const [logDays, setLogDays] = useState(7)

  const tz = user?.timezone || 'UTC'

  const fetchLog = async (userId: string, days: number, timezone: string) => {
    const token = localStorage.getItem('st_token')
    const res = await fetch(`/api/dashboard/users/${userId}/activity-log?days=${days}&tz=${encodeURIComponent(timezone)}`, {
      headers: { Authorization: 'Bearer ' + token }
    })
    const d = await res.json()
    if (Array.isArray(d)) setActivityLog(d)
  }

  useEffect(() => { api.users().then(setAllUsers).catch(() => {}) }, [])

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

  useEffect(() => { if (id) api.userHours(id, chartDays, tz).then(setHours).catch(() => {}) }, [id, chartDays, tz])

  useEffect(() => {
    if (!id) return
    const token = localStorage.getItem('st_token')
    fetch(`/api/dashboard/users/${id}/hourly?days=${heatmapDays}&tz=${encodeURIComponent(tz)}`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setHourly(d) }).catch(() => {})
  }, [id, heatmapDays, tz])

  useEffect(() => { if (id) fetchLog(id, logDays, tz) }, [id, logDays, tz])

  const chartData = (() => {
    const hoursMap: Record<string, number> = {}
    hours.forEach(h => { hoursMap[String(h.date).split('T')[0]] = h.total_minutes })
    const result = []
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const ds = d.toLocaleDateString('en-CA', { timeZone: tz })
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz })
      result.push({ date: label, hours: Math.round((hoursMap[ds] || 0) / 6) / 10 })
    }
    return result
  })()

  const gridColor = 'rgba(0,0,0,0.06)'
  const labelColor = '#94a3b8'
  const sel: React.CSSProperties = { background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', padding:'0.3rem 0.6rem', fontSize:'0.775rem', outline:'none', fontFamily:'Inter,sans-serif' }

  return (
    <div>
      {/* User header */}
      <div style={{ marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
        <h1 style={{ fontFamily:'Inter,sans-serif', fontWeight:700, fontSize:'1.2rem', color:'var(--text)', margin:0 }}>
          {user?.display_name || 'Loading...'}
        </h1>
        {user && <Badge variant={user.user_type}>{user.user_type === 'external' ? 'External' : 'Member'}</Badge>}
        {presence !== null && <StatusDot status={presence} />}
        {allUsers.length > 1 && (
          <select value={id} onChange={e => navigate(`/dashboard/user/${e.target.value}`)}
            style={{ marginLeft:'auto', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', padding:'0.3rem 0.6rem', fontSize:'0.775rem', outline:'none', fontFamily:'Inter,sans-serif' }}>
            {allUsers.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
          </select>
        )}
      </div>

      {/* Profile card */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'1.5rem', display:'flex', alignItems:'flex-start', gap:'1.5rem', marginBottom:'1.5rem', boxShadow:'var(--shadow)', flexWrap:'wrap' }}>
        <Avatar name={user?.display_name||'?'} url={user?.avatar_url} size={56} />
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ color:'var(--muted)', fontSize:'0.875rem' }}>{user?.email}</div>
          <div style={{ display:'flex', gap:'1rem', marginTop:'0.5rem', flexWrap:'wrap' }}>
            {user && <>
              <span style={{ fontSize:'0.8rem', color:'var(--muted)' }}>Team: <strong style={{ color:'var(--text)' }}>{user.team_name}</strong></span>
              <span style={{ fontSize:'0.8rem', color:'var(--muted)' }}>TZ: <strong style={{ color:'var(--text)' }}>{user.timezone?.replace(/_/g,' ')}</strong></span>
              <span style={{ fontSize:'0.8rem', color:'var(--muted)' }}>Joined: <strong style={{ color:'var(--text)' }}>{user.created_at?new Date(user.created_at).toLocaleDateString('en-US',{month:'short',year:'numeric'}):''}</strong></span>
            </>}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
        <StatCard label="Today" value={todayMins?minsToHours(todayMins):'--'} sub="hours active" />
        <StatCard label="This week" value={weekMins?minsToHours(weekMins):'--'} sub="last 7 days" />
        <StatCard label="This month" value={stats?.totalMinutes?minsToHours(stats.totalMinutes):'--'} sub="last 30 days" />
        <StatCard label="Avg / active day" value={stats?.avgPerActiveDay?minsToHours(stats.avgPerActiveDay):'--'} sub="active days only" />
        <StatCard label="Active days" value={stats?.activeDays??'--'} sub="in last 30 days" />
      </div>

      {/* Daily bar chart */}
      <Card>
        <CardHeader title="Daily Active Hours" right={
          <select value={chartDays} onChange={e => setChartDays(Number(e.target.value))} style={sel}>
            <option value={5}>Last 5 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
          </select>
        } />
        <div style={{ padding:'1.5rem' }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top:5, right:5, bottom:5, left:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fill:labelColor, fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:labelColor, fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v => v+'h'} />
              <Tooltip formatter={(v: number) => [v+'h','Active hours']} contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, fontSize:'0.85rem', fontFamily:'Inter,sans-serif' }} />
              <Bar dataKey="hours" radius={[4,4,0,0]} fillOpacity={0.85}>
                {chartData.map((entry, i) => {
                  const h = entry.hours
                  const color = h >= 7 ? '#22c55e' : h >= 4 ? '#f97316' : '#ef4444'
                  return <Cell key={i} fill={color} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Heatmap */}
      <Card>
        <CardHeader title="Activity Heatmap by Hour" right={
          <select value={heatmapDays} onChange={e => setHeatmapDays(Number(e.target.value))} style={sel}>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={21}>Last 21 days</option>
            <option value={28}>Last 28 days</option>
          </select>
        } />
        <div style={{ padding:'1.5rem' }} data-heatmap="1">
          <HourlyHeatmap data={hourly} days={heatmapDays} />
        </div>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader title="Activity Log" right={
          <select value={logDays} onChange={e => { const v=Number(e.target.value); setLogDays(v); if(id) fetchLog(id,v,tz) }} style={sel}>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        } />
        {activityLog.length === 0 ? (
          <div style={{ textAlign:'center', color:'var(--muted)', padding:'2.5rem', fontSize:'0.875rem' }}>
            No activity data yet — polls started recently, check back soon.
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>{['Date','Active','Away','Total polls'].map(h => (
                <th key={h} style={{ fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--muted)', padding:'0.75rem 1.25rem', textAlign:'left', borderBottom:'1px solid var(--border)', fontWeight:500 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {activityLog.map((day, i) => <DayTimeline key={i} day={day} />)}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}