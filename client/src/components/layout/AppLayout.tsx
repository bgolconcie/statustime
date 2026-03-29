import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { Org, User } from '../../types'
import { Toast, useToast } from '../ui/Toast'

export function AppLayout() {
  const [org, setOrg] = useState<Org | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [showPlans, setShowPlans] = useState(false)
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
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

  const logout = () => { localStorage.removeItem('st_token'); navigate('/') }
  const trialDays = org ? Math.max(0, Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 86400000)) : 0

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
          {org && <>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>{org.name}</div>
            <div style={{
              fontSize: '0.7rem',
              color: org.subscription_status === 'active' ? 'var(--green)' : 'var(--yellow)'
            }}>
              {org.subscription_status === 'active'
                ? (org.plan === 'standard' ? 'Standard plan' : 'Pro plan')
                : `Trial — ${trialDays} days left`}
            </div>
          </>}

{org?.subscription_status === 'active' ? (
            <button onClick={() => api.billingPortal().then(d => { window.location.href = d.url }).catch(() => showToast('Billing unavailable','error'))}
              style={{ display:'block', marginTop:'0.75rem', background:'var(--accent)', color:'var(--bg)', padding:'0.5rem', borderRadius:6, fontSize:'0.8rem', fontWeight:700, cursor:'pointer', border:'none', width:'100%' }}>
              Manage billing
            </button>
          ) : showPlans ? (
            <div style={{ marginTop:'0.75rem', display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              <div style={{ display:'flex', gap:'0.25rem', marginBottom:'0.35rem', background:'var(--surface2)', borderRadius:6, padding:'0.2rem' }}>
                {(['monthly','yearly'] as const).map(b => (
                  <button key={b} onClick={() => setBilling(b)} style={{ flex:1, fontSize:'0.68rem', fontWeight:600, padding:'0.25rem', borderRadius:4, border:'none', cursor:'pointer', background: billing===b ? 'var(--accent)' : 'transparent', color: billing===b ? 'var(--bg)' : 'var(--muted)', transition:'all 0.15s' }}>
                    {b === 'monthly' ? 'Monthly' : 'Yearly −17%'}
                  </button>
                ))}
              </div>
              <button onClick={() => api.billingCheckout('standard', billing).then(d => { window.location.href = d.url }).catch(() => showToast('Billing unavailable','error'))}
                style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'0.45rem 0.5rem', fontSize:'0.775rem', fontWeight:600, cursor:'pointer', color:'var(--text)', width:'100%', textAlign:'left' }}>
                Standard — <span style={{ color:'var(--accent)' }}>{billing==='yearly' ? '$60/yr' : '$6/mo'}</span>
              </button>
              <button onClick={() => api.billingCheckout('pro', billing).then(d => { window.location.href = d.url }).catch(() => showToast('Billing unavailable','error'))}
                style={{ background:'var(--accent)', border:'none', borderRadius:6, padding:'0.45rem 0.5rem', fontSize:'0.775rem', fontWeight:700, cursor:'pointer', color:'var(--bg)', width:'100%', textAlign:'left' }}>
                Pro — {billing==='yearly' ? '$90/yr' : '$9/mo'} ★
              </button>
              <button onClick={() => setShowPlans(false)} style={{ background:'transparent', border:'none', fontSize:'0.7rem', color:'var(--muted)', cursor:'pointer', padding:'0.1rem' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setShowPlans(true)}
              style={{ display:'block', marginTop:'0.75rem', background:'var(--accent)', color:'var(--bg)', padding:'0.5rem', borderRadius:6, fontSize:'0.8rem', fontWeight:700, cursor:'pointer', border:'none', width:'100%' }}>
              Upgrade to Pro
            </button>
          )}
          <button onClick={logout} style={{
            display: 'block', marginTop: '0.5rem', background: 'transparent',
            color: 'var(--muted)', padding: '0.4rem', borderRadius: 6, fontSize: '0.75rem',
            cursor: 'pointer', border: '1px solid var(--border)', width: '100%',
          }}>Log out</button>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
        <Outlet />
      </main>

      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </div>
  )
}
