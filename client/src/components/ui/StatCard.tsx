interface StatCardProps { label: string; value: string | number; sub?: string; color?: string }
export function StatCard({ label, value, sub, color = 'var(--accent)' }: StatCardProps) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'1.25rem', boxShadow:'var(--shadow)' }}>
      <div style={{ fontSize:'0.7rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.5rem' }}>{label}</div>
      <div style={{ fontFamily:'Syne,sans-serif', fontSize:'2rem', fontWeight:800, color }}>{value}</div>
      {sub && <div style={{ fontSize:'0.75rem', color:'var(--muted)', marginTop:'0.25rem' }}>{sub}</div>}
    </div>
  )
}
