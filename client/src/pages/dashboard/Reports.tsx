import { useState } from 'react'
import { Card, CardHeader } from '../../components/ui/Card'
import { api } from '../../api'
import type { Invoice, Timesheet } from '../../types'

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

  const [tsFrom, setTsFrom] = useState(weekAgo)
  const [tsTo, setTsTo] = useState(today)
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null)
  const [tsLoading, setTsLoading] = useState(false)
  const [tsError, setTsError] = useState('')

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

  const generateTimesheet = async () => {
    setTsLoading(true); setTsError(''); setTimesheet(null)
    try {
      const data = await api.timesheet(tsFrom, tsTo)
      setTimesheet(data)
    } catch {
      setTsError('Failed to generate timesheet')
    } finally {
      setTsLoading(false)
    }
  }

  const inp: React.CSSProperties = {
    background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8,
    padding:'0.6rem 0.9rem', color:'var(--text)', fontSize:'0.875rem', outline:'none', width:'100%', fontFamily:'inherit',
  }

  const fmt = (n: number, cur: string) => new Intl.NumberFormat('en-US', { style:'currency', currency: cur }).format(n)
  const fmtDate = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month:'short', day:'numeric', timeZone:'UTC' })
  const fmtH = (h: number) => h === 0 ? '—' : h < 1 ? `${Math.round(h * 60)}m` : `${h}h`

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

      <Card>
        <CardHeader title="Timesheet by Project" />
        <div style={{ padding:'1.5rem' }}>
          <div style={{ display:'flex', gap:'1rem', alignItems:'flex-end', flexWrap:'wrap', maxWidth:520, marginBottom:'1.25rem' }}>
            <div style={{ flex:1, minWidth:140 }}>
              <label style={{ display:'block', fontSize:'0.8rem', color:'var(--muted)', marginBottom:'0.4rem' }}>From</label>
              <input type="date" style={inp} value={tsFrom} onChange={e => setTsFrom(e.target.value)} />
            </div>
            <div style={{ flex:1, minWidth:140 }}>
              <label style={{ display:'block', fontSize:'0.8rem', color:'var(--muted)', marginBottom:'0.4rem' }}>To</label>
              <input type="date" style={inp} value={tsTo} onChange={e => setTsTo(e.target.value)} />
            </div>
            <button onClick={generateTimesheet} disabled={tsLoading}
              style={{ background:'var(--accent)', color:'var(--bg)', border:'none', borderRadius:8, padding:'0.6rem 1.25rem', fontSize:'0.875rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity: tsLoading ? 0.7 : 1, whiteSpace:'nowrap' }}>
              {tsLoading ? 'Generating...' : 'Generate'}
            </button>
          </div>

          {tsError && <div style={{ color:'var(--red)', fontSize:'0.875rem', marginBottom:'1rem' }}>{tsError}</div>}

          {timesheet && (
            timesheet.projects.length === 0 ? (
              <div style={{ color:'var(--muted)', fontSize:'0.875rem' }}>No activity data in this period.</div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8rem', minWidth: 400 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign:'left', padding:'0.5rem 1rem', fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--muted)', borderBottom:'2px solid var(--border)', fontWeight:500, minWidth:160, position:'sticky', left:0, background:'var(--surface)' }}>Resource</th>
                      {timesheet.dates.map(d => (
                        <th key={d} style={{ textAlign:'center', padding:'0.5rem 0.4rem', fontSize:'0.65rem', color:'var(--muted)', borderBottom:'2px solid var(--border)', fontWeight:500, minWidth:52, whiteSpace:'nowrap' }}>
                          {fmtDate(d)}
                        </th>
                      ))}
                      <th style={{ textAlign:'right', padding:'0.5rem 1rem', fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--muted)', borderBottom:'2px solid var(--border)', fontWeight:600 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timesheet.projects.map((project, pi) => [
                      <tr key={'ph'+pi}>
                        <td colSpan={timesheet.dates.length + 2} style={{ padding:'0.55rem 1rem', background:'var(--surface2)', fontWeight:700, fontSize:'0.78rem', color:'var(--accent)', borderTop: pi > 0 ? '2px solid var(--border)' : undefined, borderBottom:'1px solid var(--border)', position:'sticky', left:0 }}>
                          {project.name ?? 'No project'}
                        </td>
                      </tr>,
                      ...project.resources.map((res, ri) => (
                        <tr key={'pr'+pi+ri} style={{ background: ri % 2 === 1 ? 'var(--surface2)' : undefined }}>
                          <td style={{ padding:'0.55rem 1rem', borderBottom:'1px solid var(--border)', fontWeight:500, paddingLeft:'1.75rem', position:'sticky', left:0, background: ri % 2 === 1 ? 'var(--surface2)' : 'var(--surface)' }}>{res.display_name}</td>
                          {res.days.map((day, di) => (
                            <td key={di} style={{ padding:'0.55rem 0.4rem', borderBottom:'1px solid var(--border)', textAlign:'center', color: day.hours > 0 ? 'var(--text)' : 'var(--border)', fontWeight: day.hours >= 7 ? 700 : 400 }}>
                              {fmtH(day.hours)}
                            </td>
                          ))}
                          <td style={{ padding:'0.55rem 1rem', borderBottom:'1px solid var(--border)', textAlign:'right', fontWeight:700, color:'var(--accent)' }}>{res.total}h</td>
                        </tr>
                      )),
                      project.resources.length > 1 && (
                        <tr key={'pt'+pi} style={{ background:'var(--surface2)' }}>
                          <td style={{ padding:'0.5rem 1rem 0.5rem 1.75rem', borderBottom:'1px solid var(--border)', fontWeight:600, fontSize:'0.75rem', color:'var(--muted)', position:'sticky', left:0, background:'var(--surface2)' }}>Project total</td>
                          {timesheet.dates.map((d, di) => {
                            const dayTotal = project.resources.reduce((s, r) => s + r.days[di].hours, 0)
                            return <td key={di} style={{ padding:'0.5rem 0.4rem', borderBottom:'1px solid var(--border)', textAlign:'center', fontWeight:600, color: dayTotal > 0 ? 'var(--text)' : 'var(--border)' }}>{fmtH(Math.round(dayTotal * 100) / 100)}</td>
                          })}
                          <td style={{ padding:'0.5rem 1rem', borderBottom:'1px solid var(--border)', textAlign:'right', fontWeight:800 }}>{project.total}h</td>
                        </tr>
                      ),
                    ])}
                  </tbody>
                </table>
                <div style={{ marginTop:'0.75rem', fontSize:'0.75rem', color:'var(--muted)' }}>
                  Period: {timesheet.from} → {timesheet.to} · Hours based on presence polls (5-min intervals) in each user's timezone.
                </div>
              </div>
            )
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
