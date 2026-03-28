import { CSSProperties, ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  style?: CSSProperties
  padding?: string | number
}

export function Card({ children, style, padding }: CardProps) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: 'var(--shadow)',
      marginBottom: '1.5rem',
      ...style
    }}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: ReactNode
  right?: ReactNode
}
export function CardHeader({ title, right }: CardHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
      flexWrap: 'wrap', gap: '0.5rem'
    }}>
      <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '0.95rem' }}>{title}</h3>
      {right && <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>{right}</div>}
    </div>
  )
}
