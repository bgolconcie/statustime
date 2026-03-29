import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { Org, User } from '../../types'
import { Toast, useToast } from '../ui/Toast'

const PLANS = {
  standard: {
    label: 'Standard', color: '#64748b',
    monthly: { price: 6, billing: 'monthly' as const },
    yearly:  { price: 60, monthly_eq: 5, billing: 'yearly' as const },
    features: ['Time tracking & editing', 'Custom leave types & approvals', 'Hybrid statusing & planning', 'Real-time reports', 'Calendar integration', 'Reminders & notifications'],
  },
  pro: {
    label: 'Pro', color: '#0284c7',
    monthly: { price: 9, billing: 'monthly' as const },
    yearly:  { price: 90, monthly_eq: 7.5, billing: 'yearly' as const },
    features: ['Everything in Standard', 'Custom workweeks & overtime', 'Leave accruals and balances', 'Live status board', 'Timesheet approvals', 'Project, Task & Client Tracking'],
  },
}

function UpgradeModal({ onClose }: { onClose: () => void }) {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly')
  const [selected, setSelected] = useState<'standard' | 'pro'>('pro')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const checkout = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const { url } = await api.billingCheckout(selected, billing)
      window.location.href = url
    } catch (err) {
      setLoading(false)
      setErrorMsg(err instanceof Error ? err.message : 'Failed to connect to billing')
    }
  }

  const plan = PLANS[selected]
  const period = PLANS[selected][billing]
  const monthlyEq = billing === 'yearly' ? (selected === 'pro' ? 7.5 : 5) : (selected === 'pro' ? 9 : 6)

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:560, boxShadow:'0 24px 64px rgba(0,0,0,0.18)', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 1.5rem', borderBottom:'1px solid #e4e4e7' }}>
          <div style={{ fontWeight:800, fontSize:'1.05rem', color:'#09090b' }}>Upgrade StatusTime</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#71717a', fontSize:'1.25rem', lineHeight:1, padding:'0.1rem' }}>✕</button>
        </div>

        <div style={{ padding:'1.5rem' }}>

          {/* Billing toggle */}
          <div style={{ display:'flex', gap:'0.5rem', background:'#f4f4f5', borderRadius:10, padding:'0.25rem', marginBottom:'1.25rem' }}>
            {(['monthly','yearly'] as const).map(b => (
              <button key={b} onClick={() => setBilling(b)} style={{
                flex:1, padding:'0.5rem', border:'none', borderRadius:8, cursor:'pointer', fontSize:'0.8rem', fontWeight:600, transition:'all 0.15s',
                background: billing === b ? '#fff' : 'transparent',
                color: billing === b ? '#09090b' : '#71717a',
                boxShadow: billing === b ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>
                {b === 'monthly' ? 'Monthly' : <>Yearly <span style={{ background:'#dcfce7', color:'#16a34a', fontSize:'0.7rem', padding:'0.1rem 0.4rem', borderRadius:100, fontWeight:700 }}>Save 17%</span></>}
              </button>
            ))}
          </div>

          {/* Plan cards */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem', marginBottom:'1.25rem' }}>
            {(['standard','pro'] as const).map(key => {
              const p = PLANS[key]
              const pPeriod = p[billing]
              const pEq = billing === 'yearly' ? (key === 'pro' ? 7.5 : 5) : (key === 'pro' ? 9 : 6)
              const isSelected = selected === key
              return (
                <button key={key} onClick={() => setSelected(key)} style={{
                  border: isSelected ? `2px solid ${p.color}` : '2px solid #e4e4e7',
                  borderRadius:14, padding:'1rem', cursor:'pointer', background: isSelected ? (key === 'pro' ? '#eff6ff' : '#f8fafc') : '#fff',
                  textAlign:'left', transition:'all 0.15s', position:'relative',
                }}>
                  {key === 'pro' && <div style={{ position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)', background:'#0284c7', color:'#fff', fontSize:'0.6rem', fontWeight:700, padding:'0.15rem 0.6rem', borderRadius:100, letterSpacing:'0.05em', whiteSpace:'nowrap' }}>MOST POPULAR</div>}
                  <div style={{ fontSize:'0.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color: isSelected ? p.color : '#71717a', marginBottom:'0.5rem' }}>{p.label}</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:'0.2rem', marginBottom:'0.1rem' }}>
                    <span style={{ fontSize:'0.9rem', color:'#94a3b8' }}>$</span>
                    <span style={{ fontSize:'2.25rem', fontWeight:800, color: isSelected ? p.color : '#09090b', lineHeight:1 }}>{pEq}</span>
                    <span style={{ fontSize:'0.72rem', color:'#94a3b8', alignSelf:'flex-end', paddingBottom:'0.15rem' }}>/mo</span>
                  </div>
                  {billing === 'yearly' && (
                    <div style={{ fontSize:'0.68rem', color:'#94a3b8', marginBottom:'0.75rem' }}>${(pPeriod as any).price ?? pPeriod}/yr · billed annually</div>
                  )}
                  {billing === 'monthly' && (
                    <div style={{ fontSize:'0.68rem', color:'#94a3b8', marginBottom:'0.75rem' }}>billed monthly</div>
                  )}
                  <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                    {p.features.slice(0,4).map(f => (
                      <li key={f} style={{ fontSize:'0.72rem', color:'#52525b', display:'flex', alignItems:'flex-start', gap:'0.35rem' }}>
                        <span style={{ color:'#16a34a', fontWeight:700, flexShrink:0 }}>✓</span>{f}
                      </li>
                    ))}
                  </ul>
                </button>
              )
            })}
          </div>

          {/* Error */}
          {errorMsg && (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'0.6rem 0.85rem', fontSize:'0.78rem', color:'#dc2626', marginBottom:'0.75rem', wordBreak:'break-word' }}>
              {errorMsg}
            </div>
          )}

          {/* CTA */}
          <button onClick={checkout} disabled={loading} style={{
            width:'100%', padding:'0.85rem', borderRadius:10, border:'none', cursor:'pointer',
            background: selected === 'pro' ? '#0284c7' : '#18181b',
            color:'#fff', fontSize:'0.9rem', fontWeight:700, transition:'opacity 0.15s',
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Redirecting...' : `Start ${plan.label} ${billing === 'yearly' ? 'Yearly' : 'Monthly'} — $${monthlyEq}/mo →`}
          </button>
          <div style={{ textAlign:'center', fontSize:'0.72rem', color:'#94a3b8', marginTop:'0.65rem' }}>
            14-day free trial · No credit card required · Cancel anytime
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppLayout() {
  const [org, setOrg] = useState<Org | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [showUpgrade, setShowUpgrade] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const onUserPage = location.pathname.startsWith('/dashboard/user/')
  const { toast, showToast } = useToast()

  useEffect(() => {
    api.me().then(setOrg).catch(() => {})
    api.users().then(setUsers).catch(() => {})
    if (window.location.hash === '#slack_connected') { showToast('Slack connected!', 'success'); history.replaceState(null,'','/dashboard') }
    if (window.location.hash === '#billing_success') { showToast('Subscription activated!', 'success'); history.replaceState(null,'','/dashboard') }
  }, [])

  const logout = () => { localStorage.removeItem('st_token'); navigate('/login') }
  const trialDays = org ? Math.max(0, Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 86400000)) : 0

  const planLabel = org?.subscription_status === 'active'
    ? (org.plan === 'standard' ? 'Standard' : 'Pro')
    : 'Free'

  const navItems = [
    { to: '/dashboard', label: 'Overview', icon: 'grid', end: true },
    { to: '/dashboard/team', label: 'Team Hours', icon: 'users' },
    { to: '/dashboard/leave', label: 'Leave', icon: 'calendar' },
    { to: '/dashboard/integrations', label: 'Integrations', icon: 'link' },
    { to: '/dashboard/reports', label: 'Reports', icon: 'doc' },
  ]

  const navIcons: Record<string, string> = {
    grid: 'M3 3h7v7H3zm0 11h7v7H3zm11-11h7v7h-7zm0 11h7v7h-7z',
    users: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
    calendar: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z',
    link: 'M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8z',
    doc: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
    person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: 'var(--sidebar-width)', flexShrink: 0,
        background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '1.5rem 0',
        boxShadow: 'var(--shadow)', overflowY: 'auto',
      }}>
        <div style={{
          fontFamily: 'Inter,sans-serif', fontWeight: 800, fontSize: '1.2rem',
          color: 'var(--accent)', padding: '0 1.25rem 1.5rem',
          borderBottom: '1px solid var(--border)', marginBottom: '1rem'
        }}>
          Status<span style={{ color: 'var(--text)' }}>Time</span>
        </div>

        <nav style={{ flex: 1 }}>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.65rem 1.25rem', fontSize: '0.875rem',
                color: isActive ? 'var(--accent)' : 'var(--muted)',
                background: isActive ? 'rgba(2,132,199,0.06)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                transition: 'all 0.15s', textDecoration: 'none',
              })}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d={navIcons[item.icon]} />
              </svg>
              {item.label}
            </NavLink>
          ))}

          {users.length > 0 && (
            <NavLink to={`/dashboard/user/${users[0].id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.65rem 1.25rem', fontSize: '0.875rem',
                color: onUserPage ? 'var(--accent)' : 'var(--muted)',
                background: onUserPage ? 'rgba(2,132,199,0.06)' : 'transparent',
                borderLeft: onUserPage ? '3px solid var(--accent)' : '3px solid transparent',
                transition: 'all 0.15s', textDecoration: 'none',
              }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d={navIcons['person']} />
              </svg>
              User Details
            </NavLink>
          )}
        </nav>

        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border)' }}>
          {org && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>{org.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                <span style={{
                  fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: 100,
                  background: org.subscription_status === 'active' ? 'rgba(22,163,74,0.1)' : 'rgba(234,179,8,0.1)',
                  color: org.subscription_status === 'active' ? '#16a34a' : '#a16207',
                }}>
                  {planLabel}
                </span>
                {org.subscription_status !== 'active' && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{trialDays}d left</span>
                )}
              </div>
            </div>
          )}

          {org?.subscription_status === 'active' ? (
            <button onClick={() => api.billingPortal().then(d => { window.location.href = d.url }).catch(() => showToast('Billing unavailable', 'error'))}
              style={{ display:'block', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'0.45rem', borderRadius:6, fontSize:'0.775rem', fontWeight:600, cursor:'pointer', width:'100%', marginBottom:'0.5rem' }}>
              Manage billing
            </button>
          ) : (
            <button onClick={() => setShowUpgrade(true)}
              style={{ display:'block', background:'var(--accent)', color:'var(--bg)', padding:'0.5rem', borderRadius:6, fontSize:'0.8rem', fontWeight:700, cursor:'pointer', border:'none', width:'100%', marginBottom:'0.5rem' }}>
              Upgrade
            </button>
          )}

          <button onClick={logout} style={{
            display: 'block', background: 'transparent', color: 'var(--muted)',
            padding: '0.4rem', borderRadius: 6, fontSize: '0.75rem',
            cursor: 'pointer', border: '1px solid var(--border)', width: '100%',
          }}>Log out</button>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
        <Outlet />
      </main>

      <Toast message={toast.message} type={toast.type} visible={toast.visible} />

      {showUpgrade && (
        <UpgradeModal
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </div>
  )
}
