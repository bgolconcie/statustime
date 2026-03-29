import { useState } from 'react'
import { Card, CardHeader } from './Card'

interface BillingProps {
  userId: string
  costType?: string; costAmount?: number | null
  priceType?: string; priceAmount?: number | null
  currency?: string
  projectName?: string | null
}

export function BillingPanel({ userId, costType: ct, costAmount: ca, priceType: pt, priceAmount: pa, currency: cur, projectName: pn }: BillingProps) {
  const [costType, setCostType] = useState<string>(ct || 'hourly')
  const [costAmount, setCostAmount] = useState(ca != null ? String(ca) : '')
  const [priceType, setPriceType] = useState<string>(pt || 'hourly')
  const [priceAmount, setPriceAmount] = useState(pa != null ? String(pa) : '')
  const [currency, setCurrency] = useState(cur || 'USD')
  const [projectName, setProjectName] = useState(pn || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const WD = 21.67, HPD = 8
  const toHourly = (amt: string, type: string) => amt ? (type === 'hourly' ? parseFloat(amt) : parseFloat(amt) / (WD * HPD)) : null
  const eCost = toHourly(costAmount, costType)
  const ePrice = toHourly(priceAmount, priceType)

  const save = async () => {
    setSaving(true)
    const token = localStorage.getItem('st_token')
    await fetch(`/api/dashboard/users/${userId}/billing`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ cost_type: costType, cost_amount: costAmount ? parseFloat(costAmount) : null, price_type: priceType, price_amount: priceAmount ? parseFloat(priceAmount) : null, currency, project_name: projectName || null })
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const inp: React.CSSProperties = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.45rem 0.7rem', fontSize: '0.875rem', color: 'var(--text)', width: '100%', outline: 'none' }
  const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }

  return (
    <Card>
      <CardHeader title="Cost & Price" />
      <div style={{ padding: '1.25rem 1.25rem 0' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>Project (optional — groups this resource in the Pro Forma Invoice)</div>
        <input
          type="text"
          placeholder="e.g. Client Alpha"
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.45rem 0.7rem', fontSize: '0.875rem', color: 'var(--text)', width: '100%', outline: 'none', maxWidth: 320, boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.6rem' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', marginRight: 6 }} />
            Cost (you pay)
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <select value={costType} onChange={e => setCostType(e.target.value)} style={{ ...sel, flex: 1 }}>
              <option value="hourly">Per hour</option>
              <option value="monthly">Per month</option>
            </select>
            <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...sel, width: 80 }}>
              {['USD','EUR','GBP','CAD','AUD','CHF','ILS'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <input type="number" min="0" step="0.01" placeholder={costType === 'hourly' ? 'e.g. 45.00' : 'e.g. 5000.00'} value={costAmount} onChange={e => setCostAmount(e.target.value)} style={inp} />
          {eCost !== null && costType === 'monthly' && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 4 }}>= {currency} {eCost.toFixed(2)}/hr</div>}
        </div>
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.6rem' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', marginRight: 6 }} />
            Price (you charge)
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <select value={priceType} onChange={e => setPriceType(e.target.value)} style={{ ...sel, flex: 1 }}>
              <option value="hourly">Per hour</option>
              <option value="monthly">Per month</option>
            </select>
            <div style={{ width: 80, fontSize: '0.875rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6 }}>{currency}</div>
          </div>
          <input type="number" min="0" step="0.01" placeholder={priceType === 'hourly' ? 'e.g. 75.00' : 'e.g. 8000.00'} value={priceAmount} onChange={e => setPriceAmount(e.target.value)} style={inp} />
          {ePrice !== null && priceType === 'monthly' && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 4 }}>= {currency} {ePrice.toFixed(2)}/hr</div>}
        </div>
      </div>
      {eCost !== null && ePrice !== null && (
        <div style={{ margin: '0 1.25rem 1rem', padding: '0.65rem 1rem', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', gap: '2rem', fontSize: '0.8rem' }}>
          <div>
            <div style={{ color: 'var(--muted)', fontSize: '0.68rem', marginBottom: 2 }}>MARGIN / HR</div>
            <div style={{ fontWeight: 700, color: ePrice - eCost >= 0 ? 'var(--green)' : 'var(--red)' }}>{currency} {(ePrice - eCost).toFixed(2)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--muted)', fontSize: '0.68rem', marginBottom: 2 }}>MARGIN %</div>
            <div style={{ fontWeight: 700, color: ePrice > eCost ? 'var(--green)' : 'var(--red)' }}>{eCost > 0 ? (((ePrice - eCost) / eCost) * 100).toFixed(1) : '--'}%</div>
          </div>
        </div>
      )}
      <div style={{ padding: '0 1.25rem 1.25rem' }}>
        <button onClick={save} disabled={saving} style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 6, padding: '0.5rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save settings'}
        </button>
      </div>
    </Card>
  )
}
