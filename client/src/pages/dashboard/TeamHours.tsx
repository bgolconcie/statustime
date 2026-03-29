import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { DayHours } from '../../types'
import { Card, CardHeader } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { minsToHours, formatDate } from '../../utils'

export function TeamHours() {
  const [rows, setRows] = useState<DayHours[]>([])
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.hours(days).then(r => { setRows(r); setLoading(false) }).catch(() => setLoading(false))
  }, [days])

  return (
    <>
      <div style={{ marginBottom:'1.5rem' }}>
        <h1 style={{ fontFamily:'Inter,sans-serif', fontSize:'1.6rem', fontWeight:800, letterSpacing:'-0.5px' }}>Team Hours</h1>
        <p style={{ color:'var(--muted)', fontSize:'0.875rem', marginTop:'0.25rem' }}>Detailed breakdown by user and day</p>
      </div>
      <Card>
        <CardHeader title="Hours by member" right={
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', padding:'0.3rem 0.6rem', fontSize:'0.775rem', outline:'none' }}>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        } />
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>{['Member','Date','Hours'].map(h => (
              <th key={h} style={{ fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--muted)', padding:'0.75rem 1.25rem', textAlign:'left', borderBottom:'1px solid var(--border)', fontWeight:500 }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={3} style={{ textAlign:'center', color:'var(--muted)', padding:'2rem' }}>Loading...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={3} style={{ textAlign:'center', color:'var(--muted)', padding:'2rem' }}>No time data for this period</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} onMouseEnter={e=>(e.currentTarget.style.background='var(--surface2)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                <td style={{ padding:'0.85rem 1.25rem', borderBottom:'1px solid var(--border)', fontSize:'0.875rem' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                    <Avatar name={r.display_name||''} size={28} />
                    <span>{r.display_name}</span>
                  </div>
                </td>
                <td style={{ padding:'0.85rem 1.25rem', borderBottom:'1px solid var(--border)', fontSize:'0.875rem', color:'var(--muted)' }}>{formatDate(r.date)}</td>
                <td style={{ padding:'0.85rem 1.25rem', borderBottom:'1px solid var(--border)', fontSize:'0.875rem', fontWeight:600 }}>{minsToHours(r.total_minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}
