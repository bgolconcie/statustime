import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { Org } from '../../types'
import { useTheme } from '../../hooks/useTheme'
import { Toast, useToast } from '../ui/Toast'

export function AppLayout() {
  const [org, setOrg] = useState<Org | null>(null)
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const { toast, showToast } = useToast()

  useEffect(() => {
    api.me().then(setOrg).catch(() => {})
    if (window.location.hash === '#slack_connected') { showToast('Slack connected!', 'success'); history.replaceState(null,'','/dashboard') }
    if (window.location.hash === '#billing_success') { showToast('Subscription activated!', 'success'); history.replaceState(null,'','/dashboard') }
  }, [])

  const logout = () => { localStorage.removeItem('st_token'); navigate('/') }
  const trialDays = org ? Math.max(0, Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 86400000)) : 0

  const navItems = [
    { to: '/dashboard', label: 'Overview', icon: '📊', end: true },
    { to: '/dashboard/team', label: 'Team Hours', icon: '👥' },
    { to: '/dashboard/leave', label: 'Leave', icon: '🏖️' },
    { to: '/dashboard/integrations', label: 'Integrations', icon: '🔗' },
    { to: '/dashboard/reports', label: 'Reports', icon: '📄' },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 'var(--sidebar-width)', flexShrink: 0,
        background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '1.5rem 0',
        boxShadow: 'var(--shadow)', overflowY: 'auto',
      }}>
        <div style={{
          fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '1.2rem',
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
              <span style={{ fontSize: '1rem', width: 18, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border)' }}>
          {org && <>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>{org.name}</div>
            <div style={{
              fontSize: '0.7rem',
              color: org.subscription_status === 'active' ? 'var(--green)' : 'var(--yellow)'
            }}>
              {org.subscription_status === 'active' ? '✓ Pro plan' : `Trial — ${trialDays} days left`}
            </div>
          </>}

          {/* Theme toggle */}
          <button onClick={toggle} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            marginTop: '0.75rem', padding: '0.4rem 0.6rem', width: '100%',
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 8, cursor: 'pointer', fontSize: '0.75rem', color: 'var(--muted)',
            justifyContent: 'center',
          }}>
            <span style={{
              width: 32, height: 18, background: theme === 'dark' ? 'var(--accent)' : 'var(--border)',
              borderRadius: 100, position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}>
              <span style={{
                position: 'absolute', top: 2, left: theme === 'dark' ? 16 : 2,
                width: 14, height: 14, background: '#fff', borderRadius: '50%',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </span>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>

          <button onClick={() => api.me().then(o => o.subscription_status === 'active'
              ? api.billingPortal().then(d => window.location.href = d.url)
              : api.billingCheckout().then(d => window.location.href = d.url)
            ).catch(() => showToast('Billing unavailable','error'))}
            style={{
              display: 'block', marginTop: '0.75rem', background: 'var(--accent)',
              color: 'var(--bg)', padding: '0.5rem', borderRadius: 6, fontSize: '0.8rem',
              fontWeight: 700, cursor: 'pointer', border: 'none', width: '100%',
            }}>
            {org?.subscription_status === 'active' ? 'Manage billing' : 'Upgrade to Pro'}
          </button>
          <button onClick={logout} style={{
            display: 'block', marginTop: '0.5rem', background: 'transparent',
            color: 'var(--muted)', padding: '0.4rem', borderRadius: 6, fontSize: '0.75rem',
            cursor: 'pointer', border: '1px solid var(--border)', width: '100%',
          }}>Log out</button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
        <Outlet />
      </main>

      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </div>
  )
}
