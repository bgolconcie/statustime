interface StatCardProps { label: string; value: string | number; sub?: string; color?: string }

export function StatCard({ label, value, sub, color = 'var(--text)' }: StatCardProps) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem', boxShadow: 'var(--shadow)' }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, marginBottom: '0.5rem', fontFamily: 'Inter, sans-serif' }}>{label}</div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.35rem', fontWeight: 700, color, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.3rem', fontFamily: 'Inter, sans-serif' }}>{sub}</div>}
    </div>
  )
}
