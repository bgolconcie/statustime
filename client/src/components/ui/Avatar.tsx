import { initials } from '../../utils'

interface AvatarProps { name: string; url?: string; size?: number }

export function Avatar({ name, url, size = 34 }: AvatarProps) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg,var(--accent),var(--accent2))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.28, fontWeight: 700, color: 'white',
      flexShrink: 0, overflow: 'hidden',
    }}>
      {url
        ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        : initials(name)
      }
    </div>
  )
}
