import { useState } from 'react'
import { Card, CardHeader } from '../../components/ui/Card'
import { api } from '../../api'
import type { Invoice } from '../../types'

export function Reports() {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now()-6*86400000).toISOString().split('T')[0]
  const [from, setFrom] = useState(weekAgo)
  const [to, setTo] = useState(today)

  const [invFrom, setInvFrom] = useState(weekAgo)
  const [invTo, setInvTo] = useState(today)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(false)
  const [invError, setInvError] = useState('')

  const generateInvoice = async () => {
    setLoading(true); setInvError(''); setInvoice(null)
    try {
      const data = await api.invoice(invFrom, invTo)
      setInvoice(data)
    } catch {
      setInvError('Failed to generate invoice')
    } finally {
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = {
    background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8,
    padding:'0.6rem 0.9rem', color:'var(--text)', fontSize:'0.875rem', outline:'none', width:'100%', fontFamily:'inherit',
  }

  const fmt = (n: number, cur: string) => new Intl.NumberFormat('en-US', { style:'currency', currency: cur }).format(n)

  return (
    <>
      <div style={{ marginBottom:'1.5rem' }}>
        <h1 style={{ fontFamily:'Inter,sans-serif', fontSize:'1.6rem', fontWeight:800, letterSpacing:'-0.5px' }}>Reports</h1>
        <p style={{ color:'var(--muted)', fontSize:'0.875rem', marginTop:'0.25rem' }}>Export time data for payroll, billing, or compliance</p>
      </div>

      <Card>
        <CardHeader title="Pro Forma Invoice" />
        <div style={{ padding:'1.5rem' }}>
          <div style={{ display:'flex', gap:'1rem', alignItems:'flex-end', flexWrap:'wrap', maxWidth:520, marginBottom:'1.25rem' }}>
            <div style={{ flex:1, minWidth:140 }}>
              <label style={{ display:'block', fontSize:'0.8rem', color:'var(--muted)', marginBottom:'0.4rem' }}>From</label>
              <input type="date" style={inp} value={invFrom} onChange={e => setInvFrom(e.target.value)} />
            </div>
            <div style={{ flex:1, minWidth:140 }}>
              <label style={{ display:'block', fontSize:'0.8rem', color:'var(--muted)', marginBottom:'0.4rem' }}>To</label>
              <input type="date" style={inp} value={invTo} onChange={e => setInvTo(e.target.value)} />
            </div>
            <button onClick={generateInvoice} disabled={loading}
              style={{ background:'var(--accent)', color:'var(--bg)', border:'none', borderRadius:8, padding:'0.6rem 1.25rem', fontSize:'0.875rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity: loading ? 0.7 : 1, whiteSpace:'nowrap' }}>
              {loading ? 'Generating...' : 'Generate'}
            </button>
          </div>

          {invError && <div style={{ color:'var(--red)', fontSize:'0.875rem', marginBottom:'1rem' }}>{invError}</div>}

          {invoice && (
            invoice.lines.length === 0 ? (
              <div style={{ color:'var(--muted)', fontSize:'0.875rem' }}>No billable activity in this period.</div>
            ) : (() => {
              // Group lines by project_name (null → ungrouped)
              const groups: { name: string | null; lines: typeof invoice.lines }[] = []
              for (const line of invoice.lines) {
                const g = groups.find(g => g.name === line.project_name)
                if (g) g.lines.push(line)
                else groups.push({ name: line.project_name, lines: [line] })
              }
              const thStyle: React.CSSProperties = { textAlign:'left', padding:'0.6rem 1rem', fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--muted)', borderBottom:'1px solid var(--border)', fontWeight:500 }
              return (
                <div>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.875rem' }}>
                    <thead>
                      <tr>{['Resource','Rate type','Rate','Active hours','Amount'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {groups.map((group, gi) => {
                        const groupTotal = group.lines.reduce((s, l) => s + l.amount, 0)
                        const cur = group.lines[0].currency
                        return [
                          group.name && (
                            <tr key={'gh'+gi}>
                              <td colSpan={5} style={{ padding:'0.6rem 1rem', background:'var(--surface2)', fontWeight:700, fontSize:'0.8rem', color:'var(--accent)', borderBottom:'1px solid var(--border)', borderTop: gi > 0 ? '2px solid var(--border)' : undefined }}>
                                {group.name}
                              </td>
                            </tr>
                          ),
                          ...group.lines.map((line, i) => (
                            <tr key={'gl'+gi+i}>
                              <td style={{ padding:'0.75rem 1rem', borderBottom:'1px solid var(--border)', fontWeight:500, paddingLeft: group.name ? '1.75rem' : '1rem' }}>{line.display_name}</td>
                              <td style={{ padding:'0.75rem 1rem', borderBottom:'1px solid var(--border)', color:'var(--muted)' }}>{line.price_type === 'monthly' ? 'Monthly' : 'Hourly'}</td>
                              <td style={{ padding:'0.75rem 1rem', borderBottom:'1px solid var(--border)', color:'var(--muted)' }}>
                                {fmt(line.hourly_rate, line.currency)}/hr
                                {line.price_type === 'monthly' && <span style={{ display:'block', fontSize:'0.7rem' }}>{fmt(line.price_amount, line.currency)}/mo</span>}
                              </td>
                              <td style={{ padding:'0.75rem 1rem', borderBottom:'1px solid var(--border)' }}>{line.active_hours}h</td>
                              <td style={{ padding:'0.75rem 1rem', borderBottom:'1px solid var(--border)', fontWeight:700 }}>{fmt(line.amount, line.currency)}</td>
                            </tr>
                          )),
                          group.name && groups.length > 1 && (
                            <tr key={'gs'+gi} style={{ background:'var(--surface2)' }}>
                              <td colSpan={4} style={{ padding:'0.5rem 1rem', textAlign:'right', fontSize:'0.8rem', fontWeight:600, color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>{group.name} subtotal</td>
                              <td style={{ padding:'0.5rem 1rem', fontWeight:700, color:'var(--text)', borderBottom:'1px solid var(--border)' }}>{fmt(groupTotal, cur)}</td>
                            </tr>
                          ),
                        ]
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} style={{ padding:'0.75rem 1rem', fontWeight:700, textAlign:'right', fontSize:'0.9rem' }}>Total</td>
                        <td style={{ padding:'0.75rem 1rem', fontWeight:800, fontSize:'1rem', color:'var(--accent)' }}>{fmt(invoice.total, invoice.currency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  <div style={{ marginTop:'0.75rem', fontSize:'0.75rem', color:'var(--muted)' }}>
                    Period: {invoice.from} → {invoice.to} · Only users with a billable rate and active hours are shown.
                  </div>
                </div>
              )
            })()
          )}
        </div>
      </Card>

      <div style={{ marginTop:'1.5rem' }}>
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
      </div>
    </>
  )
}
