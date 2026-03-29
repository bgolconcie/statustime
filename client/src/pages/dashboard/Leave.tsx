import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { LeaveRequest } from '../../types'
import { Card, CardHeader } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { useToast, Toast } from '../../components/ui/Toast'

export function Leave() {
  const [rows, setRows] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const { toast, showToast } = useToast()

  const load = () => { api.leave().then(r => { setRows(r); setLoading(false) }).catch(() => setLoading(false)) }
  useEffect(() => { load() }, [])

  const update = async (id: string, status: 'approved' | 'rejected') => {
    await api.updateLeave(id, status).catch(() => {})
    showToast(`Leave ${status}!`)
    load()
  }

  return (
    <>
      <div style={{ marginBottom:'1.5rem' }}>
        <h1 style={{ fontFamily:'Inter,sans-serif', fontSize:'1.6rem', fontWeight:800, letterSpacing:'-0.5px' }}>Leave &amp; PTO</h1>
        <p style={{ color:'var(--muted)', fontSize:'0.875rem', marginTop:'0.25rem' }}>Manage team time off requests</p>
      </div>
      <Card>
        <CardHeader title="Leave requests" />
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>{['Member','Type','Dates','Status','Actions'].map(h => (
              <th key={h} style={{ fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--muted)', padding:'0.75rem 1.25rem', textAlign:'left', borderBottom:'1px solid var(--border)', fontWeight:500 }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--muted)', padding:'2rem' }}>Loading...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--muted)', padding:'2rem' }}>No leave requests</td></tr>}
            {rows.map(r => (
              <tr key={r.id} onMouseEnter={e=>(e.currentTarget.style.background='var(--surface2)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                <td style={{ padding:'0.85rem 1.25rem', borderBottom:'1px solid var(--border)', fontSize:'0.875rem' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                    <Avatar name={r.display_name} url={r.avatar_url} size={28} />
                    <span>{r.display_name}</span>
                  </div>
                </td>
                <td style={{ padding:'0.85rem 1.25rem', borderBottom:'1px solid var(--border)', fontSize:'0.875rem', textTransform:'capitalize' }}>{r.leave_type}</td>
                <td style={{ padding:'0.85rem 1.25rem', borderBottom:'1px solid var(--border)', fontSize:'0.875rem', color:'var(--muted)' }}>{r.start_date} → {r.end_date}</td>
                <td style={{ padding:'0.85rem 1.25rem', borderBottom:'1px solid var(--border)' }}>
                  <Badge variant={r.status}>{r.status}</Badge>
                </td>
                <td style={{ padding:'0.85rem 1.25rem', borderBottom:'1px solid var(--border)' }}>
                  {r.status === 'pending' ? (
                    <div style={{ display:'flex', gap:'0.3rem' }}>
                      <button onClick={() => update(r.id, 'approved')} style={{ background:'rgba(5,150,105,0.1)', border:'1px solid rgba(5,150,105,0.2)', color:'var(--green)', padding:'0.25rem 0.6rem', borderRadius:5, fontSize:'0.75rem', cursor:'pointer' }}>Approve</button>
                      <button onClick={() => update(r.id, 'rejected')} style={{ background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.2)', color:'var(--red)', padding:'0.25rem 0.6rem', borderRadius:5, fontSize:'0.75rem', cursor:'pointer' }}>Reject</button>
                    </div>
                  ) : '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Toast {...toast} />
    </>
  )
}
