import { useState } from 'react'
import { Card, CardHeader } from '../../components/ui/Card'

export function Reports() {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now()-6*86400000).toISOString().split('T')[0]
  const [from, setFrom] = useState(weekAgo)
  const [to, setTo] = useState(today)

  const inp: React.CSSProperties = {
    background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8,
    padding:'0.6rem 0.9rem', color:'var(--text)', fontSize:'0.875rem', outline:'none', width:'100%', fontFamily:'inherit',
  }

  return (
    <>
      <div style={{ marginBottom:'1.5rem' }}>
        <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.6rem', fontWeight:800, letterSpacing:'-0.5px' }}>Reports</h1>
        <p style={{ color:'var(--muted)', fontSize:'0.875rem', marginTop:'0.25rem' }}>Export time data for payroll, billing, or compliance</p>
      </div>
      <Card>
        <CardHeader title="Export to CSV" />
        <div style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem', maxWidth:400 }}>
          <div>
            <label style={{ display:'block', fontSize:'0.8rem', color:'var(--muted)', marginBottom:'0.4rem' }}>From date</label>
            <input type="date" style={inp} value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:'0.8rem', color:'var(--muted)', marginBottom:'0.4rem' }}>To date</label>
            <input type="date" style={inp} value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button onClick={() => window.location.href = `/api/dashboard/export?from=${from}&to=${to}`}
            style={{ background:'var(--accent)', color:'var(--bg)', border:'none', borderRadius:8, padding:'0.7rem 1.5rem', fontSize:'0.875rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            ⬇ Download CSV
          </button>
        </div>
      </Card>
    </>
  )
}
