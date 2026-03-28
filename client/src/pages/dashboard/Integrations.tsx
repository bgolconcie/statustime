import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { Integration } from '../../types'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { useToast, Toast } from '../../components/ui/Toast'

export function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [syncing, setSyncing] = useState(false)
  const { toast, showToast } = useToast()

  useEffect(() => { api.integrations().then(setIntegrations).catch(() => {}) }, [])

  const connectSlack = () => api.slackInstall().then(d => window.location.href = d.url).catch(() => showToast('Failed', 'error'))

  const syncSlack = async () => {
    setSyncing(true)
    try {
      const d = await api.slackSync()
      showToast(`Synced! ${d.synced} users (${Object.entries(d.breakdown).map(([k,v])=>`${v} ${k}s`).join(', ')})`)
    } catch { showToast('Sync failed', 'error') }
    setSyncing(false)
  }

  const slackInt = integrations.find(i => i.platform === 'slack')

  const cardStyle = {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '1.25rem', display: 'flex', flexDirection: 'column' as const, gap: '0.75rem',
  }

  return (
    <>
      <div style={{ marginBottom:'1.5rem' }}>
        <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.6rem', fontWeight:800, letterSpacing:'-0.5px' }}>Integrations</h1>
        <p style={{ color:'var(--muted)', fontSize:'0.875rem', marginTop:'0.25rem' }}>Connect your Slack or Teams workspace</p>
      </div>
      <Card>
        <CardHeader title="Connected platforms" />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:'1rem', padding:'1.25rem' }}>
          <div style={cardStyle}>
            <h4 style={{ fontWeight:600 }}>🟣 Slack</h4>
            <p style={{ fontSize:'0.8rem', color:'var(--muted)', lineHeight:1.6 }}>
              Connect your workspace. Members vs Single-Channel Guests are automatically detected via Slack's API.
            </p>
            {slackInt ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                <Badge variant="connected">✓ Connected — {slackInt.team_name}</Badge>
                <button onClick={syncSlack} disabled={syncing} style={{
                  background:'transparent', border:'1px solid var(--border)', borderRadius:6,
                  padding:'0.5rem 1rem', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', color:'var(--muted)',
                }}>
                  {syncing ? 'Syncing...' : '↻ Re-sync users'}
                </button>
              </div>
            ) : (
              <button onClick={connectSlack} style={{
                background:'var(--accent)', color:'var(--bg)', border:'none',
                padding:'0.5rem 1rem', borderRadius:6, fontSize:'0.8rem', fontWeight:700, cursor:'pointer',
              }}>Connect Slack</button>
            )}
          </div>
          <div style={cardStyle}>
            <h4 style={{ fontWeight:600 }}>🔵 Microsoft Teams</h4>
            <p style={{ fontSize:'0.8rem', color:'var(--muted)', lineHeight:1.6 }}>
              Connect your Teams workspace to track presence for Microsoft 365 users.
            </p>
            <button disabled style={{
              background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6,
              padding:'0.5rem 1rem', fontSize:'0.8rem', fontWeight:700, cursor:'not-allowed', color:'var(--muted)',
            }}>Coming soon</button>
          </div>
        </div>
      </Card>
      <Toast {...toast} />
    </>
  )
}
