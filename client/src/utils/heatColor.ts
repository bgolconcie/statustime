// Red(0%) -> Orange(25%) -> Yellow(50%) -> Light Green(75%) -> Green(100%)
export function heatColor(pct: number, isDark: boolean): string {
  if (pct === 0) return isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'
  const stops = [
    { p: 0,   r: 220, g: 38,  b: 38  },
    { p: 25,  r: 234, g: 88,  b: 12  },
    { p: 50,  r: 202, g: 138, b: 4   },
    { p: 75,  r: 101, g: 163, b: 13  },
    { p: 100, r: 22,  g: 163, b: 74  },
  ]
  let lo = stops[0], hi = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (pct >= stops[i].p && pct <= stops[i+1].p) { lo = stops[i]; hi = stops[i+1]; break }
  }
  const t = lo.p === hi.p ? 0 : (pct - lo.p) / (hi.p - lo.p)
  const r = Math.round(lo.r + t * (hi.r - lo.r))
  const g = Math.round(lo.g + t * (hi.g - lo.g))
  const b2 = Math.round(lo.b + t * (hi.b - lo.b))
  return `rgba(${r},${g},${b2},${isDark ? 0.85 : 0.9})`
}
