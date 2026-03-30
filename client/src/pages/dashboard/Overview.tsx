import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import type { User, Stats } from '../../types'
import { StatCard } from '../../components/ui/StatCard'
import { Card, CardHeader } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { StatusDot, StatusDotLoading } from '../../components/ui/StatusDot'
import { HoursBar } from '../../components/ui/HoursBar'
import { FilterGroup } from '../../components/ui/Button'
import { minsToHours, shortTz } from '../../utils'

function useTzClock(users: User[]) {
  const [times, setTimes] = useState<Record<string,string>>({})
  useEffect(() => {
    if (!users.length) return
    const tick = () => {
      const t: Record<string,string> = {}
      users.forEach(u => {
        try { t[u.id] = new Intl.DateTimeFormat('en-US',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:u.timezone||'UTC'}).format(new Date()) }
        catch { t[u.id] = '--:--' }
      })
      setTimes(t)
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [users])
  return times
}

export function Overview() {
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [presence, setPresence] = useState<Record<string,string>>({})
  const [presenceLoading, setPresenceLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('member')
  const navigate = useNavigate()

  const toggleTracking = async (u: User, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !u.tracking_enabled
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, tracking_enabled: next } : x))
    await api.toggleTracking(u.id, next).catch(() =>
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, tracking_enabled: !next } : x))
    )
  }
  const times = useTzClock(users)

  useEffect(() => {
    api.stats().then(setStats).catch(() => {})
    api.users().then(u => { setUsers(u); fetchPresence(u) }).catch(() => {})
  }, [])

  const fetchPresence = useCallback((us?: User[]) => {
    const list = us || users
    if (!list.length || presenceLoading) return
    setPresenceLoading(true)
    api.presence().then(p => { setPresence(p); setPresenceLoading(false) }).catch(() => setPresenceLoading(false))
  }, [users, presenceLoading])

  useEffect(() => {
    const id = setInterval(() => fetchPresence(), 60000)
    return () => clearInterval(id)
  }, [fetchPresence])

  const maxToday = Math.max(...users.map(u => u.today_minutes), 1)
  const maxWeek = Math.max(...users.map(u => u.week_minutes), 1)

  const filtered = users.filter(u => {
    const st = presence[u.id] || 'unknown'
    const statusOk = statusFilter === 'all' || st === statusFilter
    const typeOk = typeFilter === 'all' || u.user_type === typeFilter
    return statusOk && typeOk
  })

  return (
    <>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily:'Inter,sans-serif', fontSize:'1.6rem', fontWeight:800, letterSpacing:'-0.5px' }}>Overview</h1>
        <p style={{ color:'var(--muted)', fontSize:'0.875rem', marginTop:'0.25rem' }}>
          {new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
        </p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
        <StatCard label="Today's total hours" value={stats ? minsToHours(stats.todayMinutes) : '--'} sub="across all users" />
        <StatCard label="This week" value={stats ? minsToHours(stats.weekMinutes) : '--'} sub="last 7 days" />
        <StatCard label="Team size" value={stats?.totalUsers ?? '--'} sub={users.length ? `${users.filter(u=>u.user_type==='member').length} members · ${users.filter(u=>u.user_type==='external').length} guests` : 'tracked users'} />
      </div>

      <Card>
        <CardHeader title="Team — Today at a glance" right={
          <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', flexWrap:'wrap' }}>
            <FilterGroup value={statusFilter} onChange={setStatusFilter} options={[
              {label:'All',value:'all'},{label:'Online',value:'active'},{label:'Away',value:'away'}
            ]} />
            <FilterGroup value={typeFilter} onChange={setTypeFilter} options={[
              {label:'All',value:'all'},{label:'Members',value:'member'},{label:'Externals',value:'external'}
            ]} />
            {presenceLoading && <span style={{fontSize:'0.72rem',color:'var(--muted)'}}>Fetching...</span>}
          </div>
        } />
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>{['Member','Status','Today','This Week','Tracked'].map(h => (
              <th key={h} style={{fontSize:'0.7rem',textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted)',padding:'0.75rem 1.25rem',textAlign:'left',borderBottom:'1px solid var(--border)',fontWeight:500}}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} onClick={() => navigate(`/dashboard/user/${u.id}`)}
                style={{ cursor:'pointer', transition:'background 0.1s', opacity: u.tracking_enabled === false ? 0.45 : 1 }}
                onMouseEnter={e => (e.currentTarget.style.background='var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                <td style={{ padding:'0.85rem 1.25rem', borderBottom:'1px solid var(--border)', fontSize:'0.875rem' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                    <Avatar name={u.display_name} url={u.avatar_url} />
                    <div>
                      <div style={{ fontWeight:500 }}>{u.display_name}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginTop:'0.2rem', flexWrap:'wrap' }}>
                        <Badge variant={u.user_type}>{u.user_type === 'external' ? 'External' : 'Member'}</Badge>
                        <span style={{ fontSize:'0.7rem', color:'var(--muted)' }}>{times[u.id] || '--:--'} {shortTz(u.timezone)}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding:'0.85rem 1.25rem', borderBottom:'1px solid var(--border)' }}>
                  {presence[u.id] ? <StatusDot status={presence[u.id]} /> : <StatusDotLoading />}
                </td>
                <td style={{ padding:'0.85rem 1.25rem', borderBottom:'1px solid var(--border)' }}>
                  <HoursBar minutes={u.today_minutes} max={maxToday} />
                </td>
                <td style={{ padding:'0.85rem 1.25rem', borderBottom:'1px solid var(--border)' }}>
                  <HoursBar minutes={u.week_minutes} max={maxWeek} color="var(--accent2)" />
                </td>
                <td style={{ padding:'0.85rem 1.25rem', borderBottom:'1px solid var(--border)' }} onClick={e => toggleTracking(u, e)}>
                  <div style={{
                    width:36, height:20, borderRadius:10, cursor:'pointer', transition:'background 0.2s',
                    background: u.tracking_enabled !== false ? 'var(--green)' : 'var(--border)',
                    position:'relative', flexShrink:0,
                  }}>
                    <div style={{
                      position:'absolute', top:2, transition:'left 0.2s',
                      left: u.tracking_enabled !== false ? 18 : 2,
                      width:16, height:16, borderRadius:'50%', background:'#fff',
                      boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && users.length > 0 && (
              <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--muted)', padding:'2rem' }}>No users match this filter</td></tr>
            )}
            {users.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--muted)', padding:'3rem' }}>Loading...</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  )
}
