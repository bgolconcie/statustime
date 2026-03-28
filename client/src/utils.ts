export function minsToHours(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h > 0 && min > 0) return h + 'h ' + min + 'm'
  if (h > 0) return h + 'h'
  return min + 'm'
}

export function initials(name: string): string {
  return (name || '?').split(' ').map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase()
}

export function shortTz(tz: string): string {
  return (tz || '').split('/').pop()?.replace(/_/g, ' ') || tz
}

export function formatDate(dateStr: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
    ...opts
  })
}
