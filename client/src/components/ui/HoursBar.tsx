import { minsToHours } from '../../utils'
interface HoursBarProps { minutes: number; max: number; color?: string }
export function HoursBar({ minutes, max, color = 'var(--accent)' }: HoursBarProps) {
  const pct = max > 0 ? Math.round((minutes / max) * 100) : 0
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
      <div style={{ width:80, height:5, background:'var(--surface2)', borderRadius:3, overflow:'hidden', border:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width 0.4s' }} />
      </div>
      <span style={{ fontSize:'0.8rem', color:'var(--text)', fontWeight:500, minWidth:32, textAlign:'right' }}>
        {minutes ? minsToHours(minutes) : '--'}
      </span>
    </div>
  )
}
