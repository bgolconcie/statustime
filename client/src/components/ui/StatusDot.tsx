interface StatusDotProps { status: string; showLabel?: boolean }

export function StatusDot({ status, showLabel = true }: StatusDotProps) {
  const isActive = status === 'active'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.22rem 0.65rem', borderRadius: 100, fontSize: '0.72rem', fontWeight: 600,
      background: isActive ? 'rgba(5,150,105,0.1)' : 'rgba(100,116,139,0.1)',
      border: `1px solid ${isActive ? 'rgba(5,150,105,0.2)' : 'rgba(100,116,139,0.15)'}`,
      color: isActive ? 'var(--green)' : 'var(--muted)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: isActive ? 'var(--green)' : 'var(--muted)',
        boxShadow: isActive ? '0 0 5px var(--green)' : 'none',
        animation: isActive ? 'pulse 2s infinite' : 'none',
      }} />
      {showLabel && (status === 'loading' ? '--' : isActive ? 'Online' : 'Away')}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </span>
  )
}

export function StatusDotLoading() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.22rem 0.65rem', borderRadius: 100, fontSize: '0.72rem', fontWeight: 600,
      background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--border)' }} />
      --
    </span>
  )
}
