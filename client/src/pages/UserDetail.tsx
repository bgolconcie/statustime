import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import type { UserDetail as IUserDetail, DayHours, UserStats } from '../types'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { StatusDot, StatusDotLoading } from '../components/ui/StatusDot'
import { StatCard } from '../components/ui/StatCard'
import { Card, CardHeader } from '../components/ui/Card'
import { useLocalTime } from '../hooks/useLocalTime'
import { useTheme } from '../hooks/useTheme'
import { minsToHours } from '../utils'

interface HourSlot { dow: number; hour: number; pct: number; active: number; total: number }
interface HourData { hour: number; active: number; away: number; total: number }
interface DayLog { date: string; dow: string; hours: HourData[]; active_polls: number; total_polls: number; active_minutes: number; pct: number; first_active: number | null; last_active: number | null }

function HourlyHeatmap({ data, days }: { data: HourSlot[]; days: number }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [tooltip, setTooltip] = useState<{ dow: number; hour: number; pct: number; active: number; total: number; x: number; y: number } | null>(null)
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h-12}p`)
  const getLevel = (pct: number) => pct === 0 ? 0 : Math.max(1, Math.min(12, Math.round(pct / 100 * 12)))
  const getCellBg = (level: number) => {
    if (level === 0) return isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'
    const r = level / 12
    return isDark
      ? `rgba(${Math.round(20+r*36)},${Math.round(40+r*149)},${Math.round(80+r*168)},${(0.2+r*0.8).toFixed(2)})`
      : `rgb(${Math.round(219-r*182)},${Math.round(234-r*135)},${Math.round(254-r*19)})`
  }
  const grid = Array.from({ length: 7 }, (_, dow) =>
    Array.from({ length: 24 }, (_, h) => data.find(d => d.dow === dow && d.hour === h) || { dow, hour: h, pct: 0, active: 0, total: 0 })
  )
  const hasData = data.some(s => s.total > 0)
  const W = 36
  return (
    <div style={{ position: 'relative', overflowX: 'auto' }}>
      <div style={{ display: 'flex', marginLeft: W, marginBottom: 4, gap: 2 }}>
        {HOUR_LABELS.map((lbl, h) => (
          <div key={h} style={{ width: 28, flexShrink: 0, textAlign: 'center', fontSize: '0.6rem', color: 'var(--muted)' }}>{h % 3 === 0 ? lbl : ''}</div>
        ))}
      </div>
      {grid.map((row, dow) => (
        <div key={dow} style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
          <div style={{ width: W, flexShrink: 0, fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted)', textAlign: 'right', paddingRight: 8 }}>{DAY_NAMES[dow]}</div>
          <div style={{ display: 'flex', gap: 2 }}>
            {row.map(slot => (
              <div key={slot.hour}
                onMouseEnter={e => { const r=(e.currentTarget as HTMLElement).getBoundingClientRect();const p=(e.currentTarget as HTMLElement).closest('[data-heatmap]')!.getBoundingClientRect();setTooltip({...slot,x:r.left-p.left+r.width/2,y:r.top-p.top}) }}
                onMouseLeave={() => setTooltip(null)}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.filter='brightness(1.2)' }}
                style={{ width:28, height:22, borderRadius:4, flexShrink:0, background:getCellBg(getLevel(slot.pct)), border:`1px solid ${isDark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.07)'}`, cursor:'default', transition:'filter 0.1s' }}
              />
            ))}
          </div>
        </div>
      ))}
      {tooltip && (
        <div style={{ position:'absolute', top:tooltip.y-72, left:Math.max(0,tooltip.x-60), background:isDark?'#1e293b':'#fff', border:`1px solid ${isDark?'rgba(255,255,255,0.12)':'rgba(0,0,0,0.12)'}`, borderRadius:8, padding:'0.45rem 0.75rem', fontSize:'0.75rem', pointerEvents:'none', zIndex:50, whiteSpace:'nowrap', boxShadow:'0 4px 12px rgba(0,0,0,0.15)', lineHeight:1.7 }}>
          <div style={{ fontWeight:700 }}>{DAY_NAMES[tooltip.dow]} {HOUR_LABELS[tooltip.hour]}</div>
          <div style={{ color:'var(--accent)', fontWeight:600 }}>{tooltip.pct.toFixed(1)}% active</div>
          <div style={{ color:'var(--muted)', fontSize:'0.7rem' }}>{tooltip.active} / {tooltip.total} polls</div>
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:10, fontSize:'0.7rem', color:'var(--muted)', marginLeft:W }}>
        <span>0%</span>
        {[0,1,2,3,4,5,6,7,8,9,10,11,12].map(l => <div key={l} style={{ width:13, height:13, borderRadius:3, background:getCellBg(l), border:`1px solid ${isDark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.07)'}` }} />)}
        <span>100%</span>
        <span style={{ marginLeft:'auto', opacity:0.5, fontSize:'0.65rem' }}>{hasData?`5-min polls · last ${days} days`:'Waiting for first poll data...'}</span>
      </div>
    </div>
  )
}

function DayTimeline({ day, isDark }: { day: DayLog; isDark: boolean }) {
  const [tooltip, setTooltip] = useState<{ hour: number; active: number; away: number; total: number; x: number } | null>(null)
  const slots = Array.from({ length: 24 }, (_, h) => day.hours.find(d => d.hour === h) || { hour: h, active: 0, away: 0, total: 0 })
  const fmtHour = (h: number | null) => {
    if (h === null) return '--'
    if (h === 0) return '12am'
    if (h === 12) return '12pm'
    return h < 12 ? `${h}am` : `${h-12}pm`
  }
  const fmtMins = (m: number) => {
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60), rem = m % 60
    return rem ? `${h}h ${rem}m` : `${h}h`
  }
  const dateObj = new Date(day.date + 'T12:00:00Z')
  const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'0.75rem 1.25rem', borderBottom:`1px solid ${isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'}`, flexWrap:'wrap' }}>
      <div style={{ minWidth:90, flexShrink:0 }}>
        <div style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text)' }}>{dateLabel}</div>
        <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginTop:1 }}>{day.dow}</div>
      </div>
      <div style={{ flex:1, minWidth:200, position:'relative' }} onMouseLeave={() => setTooltip(null)}>
        <div style={{ display:'flex', height:20, borderRadius:4, overflow:'hidden', gap:1, background:isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)' }}>
          {slots.map(slot => {
            const hasPoll = slot.total > 0
            const pct = hasPoll ? slot.active / slot.total : 0
            const bg = !hasPoll ? (isDark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.04)')
              : pct > 0.5 ? `rgba(37,99,235,${0.3+pct*0.7})` : `rgba(148,163,184,${0.2+(1-pct)*0.3})`
            return (
              <div key={slot.hour}
                onMouseEnter={e => { const r=(e.currentTarget as HTMLElement).getBoundingClientRect();const p=(e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();setTooltip({...slot,x:r.left-p.left+r.width/2}) }}
                style={{ flex:1, background:bg, cursor:'default' }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.filter='brightness(1.3)' }}
              />
            )
          })}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
          {[0,6,12,18,23].map(h => <div key={h} style={{ fontSize:'0.55rem', color:'var(--muted)' }}>{fmtHour(h)}</div>)}
        </div>
        {tooltip && (
          <div style={{ position:'absolute', bottom:32, left:Math.max(0,Math.min(tooltip.x-50,200)), background:isDark?'#1e293b':'#fff', border:`1px solid ${isDark?'rgba(255,255,255,0.12)':'rgba(0,0,0,0.1)'}`, borderRadius:6, padding:'0.35rem 0.6rem', fontSize:'0.72rem', pointerEvents:'none', zIndex:50, whiteSpace:'nowrap', boxShadow:'0 2px 8px rgba(0,0,0,0.12)', lineHeight:1.6 }}>
            <div style={{ fontWeight:600 }}>{fmtHour(tooltip.hour)}&ndash;{fmtHour(tooltip.hour+1>23?0:tooltip.hour+1)}</div>
            {tooltip.total > 0 ? <>
              <div style={{ color:'var(--accent)' }}>{tooltip.active} active / {tooltip.away} away</div>
              <div style={{ color:'var(--muted)' }}>{Math.round(tooltip.active/tooltip.total*100)}% of {tooltip.total} polls</div>
            </> : <div style={{ color:'var(--muted)' }}>No data</div>}
          </div>
        )}
      </div>
      <div style={{ display:'flex', gap:'1.5rem', flexShrink:0, fontSize:'0.78rem' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontWeight:700, color:'var(--accent)' }}>{fmtMins(day.active_minutes)}</div>
          <div style={{ color:'var(--muted)', fontSize:'0.68rem' }}>active</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontWeight:700, color:'var(--text)' }}>{day.pct.toFixed(0)}%</div>
          <div style={{ color:'var(--muted)', fontSize:'0.68rem' }}>of polls</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontWeight:600, color:'var(--text)', fontSize:'0.75rem' }}>{fmtHour(day.first_active)}</div>
          <div style={{ color:'var(--muted)', fontSize:'0.68rem' }}>first seen</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontWeight:600, color:'var(--text)', fontSize:'0.75rem' }}>{fmtHour(day.last_active)}</div>
          <div style={{ color:'var(--muted)', fontSize:'0.68rem' }}>last seen</div>
        </div>
      </div>
    </div>
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
  const [todayMins, setTodayMins] = useState(0)
  const [weekMins, setWeekMins] = useState(0)
  const [chartDays, setChartDays] = useState(5)
  const [heatmapDays, setHeatmapDays] = useState(30)
  const [logDays, setLogDays] = useState(7)
  const { theme } = useTheme()
  const { time, date } = useLocalTime(user?.timezone || '')
  const isDark = theme === 'dark'

  const fetchLog = async (userId: string, days: number) => {
    const token = localStorage.getItem('st_token')
    const res = await fetch(`/api/dashboard/users/${userId}/activity-log?days=${days}`, {
      headers: { Authorization: 'Bearer ' + token }
    })
    const d = await res.json()
    if (Array.isArray(d)) setActivityLog(d)
  }

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

  useEffect(() => { if (id) api.userHours(id, chartDays).then(setHours).catch(() => {}) }, [id, chartDays])

  useEffect(() => {
    if (!id) return
    const token = localStorage.getItem('st_token')
    fetch(`/api/dashboard/users/${id}/hourly?days=${heatmapDays}`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setHourly(d) }).catch(() => {})
  }, [id, heatmapDays])

  useEffect(() => { if (id) fetchLog(id, logDays) }, [id, logDays])

  const chartData = (() => {
    const hoursMap: Record<string, number> = {}
    hours.forEach(h => { hoursMap[String(h.date).split('T')[0]] = h.total_minutes })
    const result = []
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(); d.setUTCHours(0,0,0,0); d.setUTCDate(d.getUTCDate()-i)
      const ds = d.toISOString().split('T')[0]
      result.push({ date: d.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}), hours: Math.round((hoursMap[ds]||0)/6)/10 })
    }
    return result
  })()

  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const labelColor = isDark ? '#64748b' : '#94a3b8'
  const sel: React.CSSProperties = { background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', padding:'0.3rem 0.6rem', fontSize:'0.775rem', outline:'none', fontFamily:'Inter,sans-serif' }

  return (
    <div>
      {/* Back button + user header */}
      <div style={{ marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:'1rem' }}>
        <button onClick={() => navigate('/dashboard')} style={{ display:'inline-flex', alignItems:'center', gap:'0.4rem', color:'var(--muted)', fontSize:'0.875rem', padding:'0.35rem 0.75rem', borderRadius:6, border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          Back
        </button>
        <h1 style={{ fontFamily:'Inter,sans-serif', fontWeight:700, fontSize:'1.2rem', color:'var(--text)', margin:0 }}>
          {user?.display_name || 'Loading...'}
        </h1>
        {user && <Badge variant={user.user_type}>{user.user_type === 'external' ? 'External' : 'Member'}</Badge>}
        {presence !== null && <StatusDot status={presence} />}
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
        <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, padding:'0.75rem 1rem', textAlign:'right', flexShrink:0 }}>
          <div style={{ fontFamily:'Inter,sans-serif', fontSize:'1.3rem', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{time||'--:--'}</div>
          <div style={{ fontSize:'0.72rem', color:'var(--muted)' }}>{user?.timezone?.split('/').pop()?.replace(/_/g,' ')}</div>
          <div style={{ fontSize:'0.7rem', color:'var(--muted)' }}>{date}</div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
        <StatCard label="Today" value={todayMins?minsToHours(todayMins):'--'} sub="hours active" color="var(--green)" />
        <StatCard label="This week" value={weekMins?minsToHours(weekMins):'--'} sub="last 7 days" color="var(--accent)" />
        <StatCard label="This month" value={stats?.totalMinutes?minsToHours(stats.totalMinutes):'--'} sub="last 30 days" color="var(--accent2)" />
        <StatCard label="Avg / active day" value={stats?.avgPerActiveDay?minsToHours(stats.avgPerActiveDay):'--'} sub="active days only" color="var(--yellow)" />
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
                  const color = h >= 8 ? '#22c55e' : h >= 6 ? 'var(--accent)' : h >= 4 ? '#f97316' : '#ef4444'
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
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
          </select>
        } />
        <div style={{ padding:'1.5rem' }} data-heatmap="1">
          <HourlyHeatmap data={hourly} days={heatmapDays} />
        </div>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader title="Activity Log" right={
          <select value={logDays} onChange={e => { const v=Number(e.target.value); setLogDays(v); if(id) fetchLog(id,v) }} style={sel}>
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
          <div>
            <div style={{ display:'flex', gap:'1rem', padding:'0.5rem 1.25rem', borderBottom:`1px solid ${isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'}` }}>
              <div style={{ minWidth:90, fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--muted)', fontWeight:500 }}>Date</div>
              <div style={{ flex:1, fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--muted)', fontWeight:500 }}>Timeline (24h)</div>
              <div style={{ display:'flex', gap:'1.5rem', flexShrink:0 }}>
                {['Active','% Polls','First','Last'].map(h => (
                  <div key={h} style={{ textAlign:'center', minWidth:50, fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--muted)', fontWeight:500 }}>{h}</div>
                ))}
              </div>
            </div>
            {activityLog.map((day, i) => <DayTimeline key={i} day={day} isDark={isDark} />)}
          </div>
        )}
      </Card>
    </div>
  )
}