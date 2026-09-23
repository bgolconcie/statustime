// Sample users, listings and a conversation, shared by the server seed and the in-browser demo
import { PHONE_PROOFS } from './catalog.js'

export const DEMO_PASSWORD = 'demo1234'

export const DEMO_USERS = [
  { key: 'dana', name: 'Dana', email: 'dana@sellfree.test' },
  { key: 'yossi', name: 'Yossi', email: 'yossi@sellfree.test' },
]

// Simple stand-in "screenshots" for demo phones
function mockScreenshot(title, rows) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const lines = rows
    .map(([label, value], i) => {
      const y = 150 + i * 56
      return `<rect x="16" y="${y - 32}" width="358" height="52" fill="#fff"/>` +
        `<text x="32" y="${y}" font-size="17" fill="#111">${esc(label)}</text>` +
        `<text x="358" y="${y}" font-size="17" fill="#8a8a8e" text-anchor="end">${esc(value)}</text>`
    })
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="700" font-family="Inter, Arial, sans-serif">` +
    `<rect width="390" height="700" fill="#f2f2f7"/>` +
    `<text x="24" y="80" font-size="30" font-weight="700" fill="#111">${esc(title)}</text>${lines}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function demoProofs({ brand, model }, { storageGb, purchaseDate, batteryHealthPct }) {
  const [year, month] = purchaseDate.split('-').map(Number)
  const purchased = `${new Date(year, month - 1).toLocaleString('en', { month: 'short' })} ${year}`
  const shots = {
    modelStorage: mockScreenshot('About', [['Model Name', `${brand} ${model}`], ['Capacity', storageGb ? `${storageGb} GB` : '—'], ['Network', 'No SIM restrictions']]),
    purchaseDate: mockScreenshot('Warranty', [['Purchase Date', purchased], ['Limited Warranty', 'Expired']]),
    network: mockScreenshot('About', [['Carrier Lock', 'No SIM restrictions'], ['IMEI', '35 •••••• •••••• 0']]),
    battery: batteryHealthPct == null
      ? mockScreenshot('Battery', [['Battery Usage', 'Last 24 Hours'], ['Low Power Mode', 'Off']])
      : mockScreenshot('Battery Health', [['Maximum Capacity', `${batteryHealthPct}%`], ['Peak Performance', 'Normal']]),
    diagnostics: mockScreenshot('Diagnostics', [['Display', 'Genuine'], ['Battery', 'Genuine'], ['Camera', 'Genuine'], ['All tests', 'Passed']]),
  }
  return PHONE_PROOFS.map((kind) => ({ kind, image: shots[kind] }))
}

// Illustrated stand-in for a seller's photo of the device
function deviceImage(kind, { body = '#1f2937', screen = ['#6366f1', '#22d3ee'], cracked = false } = {}) {
  const [w, h, r] = kind === 'tablets' ? [290, 390, 30] : [170, 350, 36]
  const x = (600 - w) / 2
  const y = (600 - h) / 2
  const inset = kind === 'tablets' ? 22 : 12
  const crack = cracked
    ? `<polyline points="${x + 40},${y + 70} ${x + 95},${y + 150} ${x + 80},${y + 210} ${x + 150},${y + 300}" fill="none" stroke="#fff" stroke-width="3" opacity="0.9"/>` +
      `<polyline points="${x + 95},${y + 150} ${x + 160},${y + 130}" fill="none" stroke="#fff" stroke-width="2" opacity="0.8"/>`
    : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${screen[0]}"/><stop offset="1" stop-color="${screen[1]}"/></linearGradient></defs>` +
    `<rect width="600" height="600" fill="#eef0f3"/>` +
    `<ellipse cx="300" cy="${y + h + 18}" rx="${w / 2}" ry="14" fill="#000" opacity="0.08"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${body}"/>` +
    `<rect x="${x + inset}" y="${y + inset}" width="${w - 2 * inset}" height="${h - 2 * inset}" rx="${r - inset / 2}" fill="url(#g)"/>` +
    crack + `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const listing = (seller, category, brand, model, [en, he], [dEn, dHe], condition, price, ageGroups, look) => ({
  seller, category, brand, model, condition, price, ageGroups,
  title: he,
  description: dHe,
  i18n: { title: { en, he }, description: { en: dEn, he: dHe } },
  image: deviceImage(category, look),
})

// Facts as if the AI read them from each demo device's screenshots and photo
const device = (item, facts) => ({
  ...item,
  proofs: demoProofs(item, facts),
  facts: {
    brand: item.brand, model: item.model, nonGenuineParts: [], diagnosticsPassed: true, networkLocked: false,
    screenCondition: 'lightScratches', bodyCondition: 'lightWear', problems: [], confidence: 'high', issues: [], ...facts,
  },
})

// Newest first; prices in shekels
export const DEMO_LISTINGS = [
  device(
    listing('dana', 'phones', 'Apple', 'iPhone 13', ['iPhone 13, 128GB, blue', 'iPhone 13, 128GB, כחול'], ['Battery 87%, always used with a case.', 'סוללה 87%, תמיד היה עם כיסוי.'], 'likeNew', 1900, ['teens', 'adults'], { body: '#1e3a5f', screen: ['#60a5fa', '#1e40af'] }),
    { storageGb: 128, purchaseDate: '2022-03', batteryHealthPct: 87, launchPriceIls: 3700, releaseYear: 2021, screenCondition: 'flawless' }
  ),
  device(
    listing('dana', 'phones', 'Samsung', 'Galaxy A14', ['Samsung Galaxy A14 — great first phone', 'Samsung Galaxy A14 — טלפון ראשון מעולה'], ['Simple and durable, parental controls set up.', 'פשוט ועמיד, מוגדרות הגבלות הורים.'], 'good', 450, ['kids', 'teens'], { body: '#111827', screen: ['#34d399', '#0f766e'] }),
    { storageGb: 64, purchaseDate: '2024-01', batteryHealthPct: 94, launchPriceIls: 900, releaseYear: 2023 }
  ),
  device(
    listing('yossi', 'tablets', 'Apple', 'iPad (9th generation)', ['iPad 9th gen, 64GB, Wi‑Fi', 'אייפד דור 9, 64GB, Wi‑Fi'], ['With a keyboard case. Great for school.', 'כולל כיסוי עם מקלדת. מעולה ללימודים.'], 'good', 900, ['kids', 'teens', 'adults'], { body: '#9ca3af', screen: ['#f472b6', '#7c3aed'] }),
    { storageGb: 64, purchaseDate: '2022-11', batteryHealthPct: null, launchPriceIls: 1600, releaseYear: 2021 }
  ),
  device(
    listing('yossi', 'tablets', 'Samsung', 'Galaxy Tab A8', ['Samsung Galaxy Tab A8, 32GB', 'Samsung Galaxy Tab A8, 32GB'], ['Kids profile set up, comes with a sturdy case.', 'מוגדר פרופיל ילדים, מגיע עם כיסוי עמיד.'], 'good', 450, ['kids'], { body: '#374151', screen: ['#fbbf24', '#ea580c'] }),
    { storageGb: 32, purchaseDate: '2023-06', batteryHealthPct: 88, launchPriceIls: 1000, releaseYear: 2022, bodyCondition: 'heavyWear' }
  ),
  device(
    listing('yossi', 'phones', 'Nokia', '105', ['Nokia 105 — basic phone, large keys', 'Nokia 105 — טלפון בסיסי עם מקשים גדולים'], ['Long battery life, easy to use.', 'סוללה שמחזיקה הרבה, קל לשימוש.'], 'new', 120, ['seniors'], { body: '#1d4ed8', screen: ['#e5e7eb', '#9ca3af'] }),
    { storageGb: null, purchaseDate: '2025-08', batteryHealthPct: 100, launchPriceIls: 130, releaseYear: 2019, screenCondition: 'flawless', bodyCondition: 'flawless' }
  ),
  device(
    listing('dana', 'phones', 'Xiaomi', 'Redmi Note 10', ['Xiaomi Redmi Note 10, cracked screen', 'Xiaomi Redmi Note 10, מסך סדוק'], ['Works, but the screen is cracked. For parts or repair.', 'עובד, אבל המסך סדוק. לחלקים או לתיקון.'], 'forParts', 150, ['adults'], { body: '#0f172a', screen: ['#475569', '#0f172a'], cracked: true }),
    {
      storageGb: 128, purchaseDate: '2021-06', batteryHealthPct: 79, launchPriceIls: 1100, releaseYear: 2021,
      screenCondition: 'cracked', bodyCondition: 'heavyWear', problems: ['מסך סדוק', 'סוללה מתחת ל-80%'],
    }
  ),
]

// Yossi asked Dana about the iPhone; Dana answered and Yossi hasn't read it yet
export const DEMO_CONVERSATION = {
  listing: 0,
  buyer: 'yossi',
  seller: 'dana',
  messages: [
    { from: 'yossi', body: 'היי, האייפון עדיין זמין? מה מצב הסוללה?', ago: 120_000 },
    { from: 'dana', body: 'כן! הסוללה 87%, אפשר לבוא לראות מחר.', ago: 60_000 },
  ],
}
