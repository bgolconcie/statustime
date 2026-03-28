import { CSSProperties, ReactNode, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  children: ReactNode
  style?: CSSProperties
}

export function Button({ variant = 'ghost', size = 'sm', children, style, ...props }: ButtonProps) {
  const base: CSSProperties = {
    fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer',
    border: 'none', borderRadius: 6, transition: 'all 0.15s',
    padding: size === 'sm' ? '0.35rem 0.85rem' : '0.65rem 1.25rem',
    fontSize: size === 'sm' ? '0.775rem' : '0.9rem',
  }
  const variants: Record<string, CSSProperties> = {
    primary: { background: 'var(--accent)', color: 'white' },
    ghost: { background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)' },
    danger: { background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: 'var(--red)' },
  }
  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...props}>
      {children}
    </button>
  )
}

interface FilterGroupProps {
  options: { label: string; value: string }[]
  value: string
  onChange: (v: string) => void
}
export function FilterGroup({ options, value, onChange }: FilterGroupProps) {
  return (
    <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
            cursor: 'pointer', border: 'none', transition: 'all 0.15s', whiteSpace: 'nowrap',
            background: value === opt.value ? 'var(--accent)' : 'transparent',
            color: value === opt.value ? 'white' : 'var(--muted)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
