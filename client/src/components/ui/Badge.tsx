import { CSSProperties } from 'react'

interface BadgeProps {
  variant?: 'member' | 'external' | 'active' | 'away' | 'pending' | 'approved' | 'rejected' | 'connected'
  children: React.ReactNode
  style?: CSSProperties
}

const styles: Record<string, CSSProperties> = {
  member: { background: 'rgba(2,132,199,0.1)', color: 'var(--accent)', border: '1px solid rgba(2,132,199,0.2)' },
  external: { background: 'rgba(124,58,237,0.1)', color: 'var(--accent2)', border: '1px solid rgba(124,58,237,0.2)' },
  active: { background: 'rgba(5,150,105,0.1)', color: 'var(--green)', border: '1px solid rgba(5,150,105,0.2)' },
  away: { background: 'rgba(100,116,139,0.1)', color: 'var(--muted)', border: '1px solid rgba(100,116,139,0.15)' },
  pending: { background: 'rgba(217,119,6,0.1)', color: 'var(--yellow)', border: '1px solid rgba(217,119,6,0.2)' },
  approved: { background: 'rgba(5,150,105,0.1)', color: 'var(--green)', border: '1px solid rgba(5,150,105,0.2)' },
  rejected: { background: 'rgba(220,38,38,0.1)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.2)' },
  connected: { background: 'rgba(5,150,105,0.1)', color: 'var(--green)', border: '1px solid rgba(5,150,105,0.2)' },
}

export function Badge({ variant = 'member', children, style }: BadgeProps) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: '0.7rem', fontWeight: 600,
      padding: '0.18rem 0.55rem', borderRadius: 100,
      ...styles[variant], ...style
    }}>
      {children}
    </span>
  )
}
