// Drawn stand-ins for settings screenshots and device photos: the examples shown to sellers
// and the sample listings. Plain SVG data URLs so they work in the browser and on the server.

const svgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

// An iOS-style settings screen; `highlight` outlines the rows a seller must capture
export function mockScreenshot(title, rows, { highlight = [] } = {}) {
  const lines = rows
    .map(([label, value], i) => {
      const y = 150 + i * 56
      const mark = highlight.includes(i)
        ? `<rect x="10" y="${y - 38}" width="370" height="64" rx="10" fill="none" stroke="#16a34a" stroke-width="4"/>`
        : ''
      return `<rect x="16" y="${y - 32}" width="358" height="52" fill="#fff"/>` +
        `<text x="32" y="${y}" font-size="17" fill="#111">${esc(label)}</text>` +
        `<text x="358" y="${y}" font-size="17" fill="#8a8a8e" text-anchor="end">${esc(value)}</text>` + mark
    })
    .join('')
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="700" font-family="Inter, Arial, sans-serif">` +
      `<rect width="390" height="700" fill="#f2f2f7"/>` +
      `<text x="24" y="80" font-size="30" font-weight="700" fill="#111">${esc(title)}</text>${lines}</svg>`
  )
}

function crackLines(x, y) {
  return `<polyline points="${x + 40},${y + 70} ${x + 95},${y + 150} ${x + 80},${y + 210} ${x + 150},${y + 300}" fill="none" stroke="#fff" stroke-width="3" opacity="0.9"/>` +
    `<polyline points="${x + 95},${y + 150} ${x + 160},${y + 130}" fill="none" stroke="#fff" stroke-width="2" opacity="0.8"/>`
}

// A photo of a phone or tablet: view is 'screenOn' (white test screen), 'screenOff', 'back' or 'box'
export function devicePhoto(kind, view, { body = '#1f2937', cracked = false } = {}) {
  const [w, h, r] = kind === 'tablets' ? [290, 390, 30] : [170, 350, 36]
  const x = (600 - w) / 2
  const y = (600 - h) / 2
  const inset = kind === 'tablets' ? 22 : 12
  const shadow = `<ellipse cx="300" cy="${y + h + 18}" rx="${w / 2}" ry="14" fill="#000" opacity="0.08"/>`
  let shape
  if (view === 'box') {
    shape =
      `<rect x="150" y="170" width="300" height="230" rx="18" fill="#fafafa" stroke="#d4d4d8" stroke-width="3"/>` +
      `<rect x="180" y="200" width="240" height="170" rx="12" fill="${body}" opacity="0.85"/>` +
      `<path d="M190 460 C 250 420, 350 500, 410 450 S 470 420, 450 480" fill="none" stroke="#f4f4f5" stroke-width="12" stroke-linecap="round"/>` +
      `<path d="M190 460 C 250 420, 350 500, 410 450 S 470 420, 450 480" fill="none" stroke="#a1a1aa" stroke-width="2"/>` +
      `<rect x="440" y="470" width="30" height="20" rx="4" fill="#e4e4e7" stroke="#a1a1aa"/>`
  } else if (view === 'back') {
    const cam = kind === 'tablets' ? 34 : 30
    shape =
      shadow + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${body}"/>` +
      `<rect x="${x + 14}" y="${y + 14}" width="${cam * 2 + 22}" height="${cam * 2 + 22}" rx="${cam / 1.4}" fill="#000" opacity="0.25"/>` +
      `<circle cx="${x + 14 + 11 + cam / 2}" cy="${y + 14 + 11 + cam / 2}" r="${cam / 2.3}" fill="#111"/>` +
      `<circle cx="${x + 14 + 11 + cam * 1.5}" cy="${y + 14 + 11 + cam * 1.5}" r="${cam / 2.3}" fill="#111"/>` +
      `<circle cx="300" cy="${y + h / 2}" r="18" fill="#fff" opacity="0.18"/>`
  } else {
    const screen = view === 'screenOn'
      ? `<rect x="${x + inset}" y="${y + inset}" width="${w - 2 * inset}" height="${h - 2 * inset}" rx="${r - inset / 2}" fill="#fff"/>`
      : `<rect x="${x + inset}" y="${y + inset}" width="${w - 2 * inset}" height="${h - 2 * inset}" rx="${r - inset / 2}" fill="#0b0f19"/>` +
        `<polygon points="${x + inset},${y + h * 0.55} ${x + w - inset},${y + h * 0.25} ${x + w - inset},${y + h * 0.4} ${x + inset},${y + h * 0.7}" fill="#fff" opacity="0.07"/>`
    shape =
      shadow + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${body}"/>` + screen +
      (cracked ? crackLines(x, y).replaceAll('#fff', view === 'screenOn' ? '#555' : '#fff') : '')
  }
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" fill="#eef0f3"/>${shape}</svg>`)
}

// What each slot should look like, shown next to its instructions
let examples
export function proofExamples() {
  examples ??= {
    deviceInfo: mockScreenshot('About', [['Name', 'iPhone'], ['Model Name', 'iPhone 13'], ['Model Number', 'A2633'], ['Capacity', '128 GB']], { highlight: [1, 2, 3] }),
    partsLock: mockScreenshot('About', [['Carrier Lock', 'No SIM restrictions'], ['Parts and Service History', ''], ['Battery', 'Genuine Apple Part'], ['Display', 'Genuine Apple Part']], { highlight: [0, 2, 3] }),
    battery: mockScreenshot('Battery Health', [['Maximum Capacity', '87%'], ['Peak Performance', 'Normal'], ['Cycle Count', '412']], { highlight: [0] }),
    purchaseDate: mockScreenshot('AppleCare & Warranty', [['Purchase Date', 'Mar 2022'], ['Limited Warranty', 'Expired']], { highlight: [0] }),
    screenOn: devicePhoto('phones', 'screenOn', { body: '#1e3a5f' }),
    screenOff: devicePhoto('phones', 'screenOff', { body: '#1e3a5f' }),
    back: devicePhoto('phones', 'back', { body: '#1e3a5f' }),
    box: devicePhoto('phones', 'box', { body: '#1e3a5f' }),
  }
  return examples
}
