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

const listing = (seller, category, brand, model, [en, he], [dEn, dHe], condition, price, ageGroups) => ({
  seller, category, brand, model, condition, price, ageGroups,
  title: he,
  description: dHe,
  i18n: { title: { en, he }, description: { en: dEn, he: dHe } },
})

// Facts as if read from each demo phone's screenshots
const phone = (item, facts) => ({
  ...item,
  proofs: demoProofs(item, facts),
  facts: {
    brand: item.brand, model: item.model, nonGenuineParts: [], diagnosticsPassed: true, networkLocked: false,
    confidence: 'high', issues: [], ...facts,
  },
})

// Newest first; prices in shekels
export const DEMO_LISTINGS = [
  phone(
    listing('dana', 'phones', 'Apple', 'iPhone 13', ['iPhone 13, 128GB, blue', 'iPhone 13, 128GB, כחול'], ['Battery 87%, always used with a case.', 'סוללה 87%, תמיד היה עם כיסוי.'], 'likeNew', 1900, ['teens', 'adults']),
    { storageGb: 128, purchaseDate: '2022-03', batteryHealthPct: 87, launchPriceIls: 3700, releaseYear: 2021 }
  ),
  phone(
    listing('dana', 'phones', 'Samsung', 'Galaxy A14', ['Samsung Galaxy A14 — great first phone', 'Samsung Galaxy A14 — טלפון ראשון מעולה'], ['Simple and durable, parental controls set up.', 'פשוט ועמיד, מוגדרות הגבלות הורים.'], 'good', 450, ['kids', 'teens']),
    { storageGb: 64, purchaseDate: '2024-01', batteryHealthPct: 94, launchPriceIls: 900, releaseYear: 2023 }
  ),
  phone(
    listing('yossi', 'tablets', 'Apple', 'iPad (9th generation)', ['iPad 9th gen, 64GB, Wi‑Fi', 'אייפד דור 9, 64GB, Wi‑Fi'], ['With a keyboard case. Great for school.', 'כולל כיסוי עם מקלדת. מעולה ללימודים.'], 'good', 900, ['kids', 'teens', 'adults']),
    { storageGb: 64, purchaseDate: '2022-11', batteryHealthPct: null, launchPriceIls: 1600, releaseYear: 2021 }
  ),
  listing('dana', 'computers', 'Lenovo', 'IdeaPad 3', ['Lenovo IdeaPad 3 laptop, 15.6"', 'מחשב נייד Lenovo IdeaPad 3, 15.6 אינץ\''], ['Ryzen 5, 8GB RAM, 256GB SSD. Good for school.', 'Ryzen 5, 8GB RAM, 256GB SSD. מתאים ללימודים.'], 'good', 1300, ['kids', 'teens', 'adults']),
  listing('yossi', 'computers', 'Apple', 'MacBook Air M1', ['MacBook Air M1, 2020', 'MacBook Air M1, 2020'], ['8GB / 256GB, 180 battery cycles, charger included.', '8GB / 256GB, 180 מחזורי סוללה, כולל מטען.'], 'likeNew', 2800, ['teens', 'adults']),
  listing('yossi', 'tvs', 'LG', '55UQ7500', ['LG 55" 4K smart TV', 'טלוויזיה חכמה LG 55 אינץ\' 4K'], ['With remote and wall mount. Pick up in Tel Aviv.', 'כולל שלט ומתקן תלייה. איסוף מתל אביב.'], 'good', 1500, ['adults', 'seniors']),
  listing('yossi', 'tvs', 'Samsung', 'UE32T4300', ['Samsung 32" TV', 'טלוויזיה Samsung 32 אינץ\''], ['Simple, big buttons on the remote.', 'פשוטה, שלט עם כפתורים גדולים.'], 'good', 400, ['kids', 'adults', 'seniors']),
  phone(
    listing('yossi', 'phones', 'Nokia', '105', ['Nokia 105 — basic phone, large keys', 'Nokia 105 — טלפון בסיסי עם מקשים גדולים'], ['Long battery life, easy to use.', 'סוללה שמחזיקה הרבה, קל לשימוש.'], 'new', 120, ['seniors']),
    { storageGb: null, purchaseDate: '2025-08', batteryHealthPct: 100, launchPriceIls: 130, releaseYear: 2019 }
  ),
  phone(
    listing('dana', 'phones', 'Xiaomi', 'Redmi Note 10', ['Xiaomi Redmi Note 10, cracked screen', 'Xiaomi Redmi Note 10, מסך סדוק'], ['Works, but the screen is cracked. For parts or repair.', 'עובד, אבל המסך סדוק. לחלקים או לתיקון.'], 'forParts', 150, ['adults']),
    { storageGb: 128, purchaseDate: '2021-06', batteryHealthPct: 79, launchPriceIls: 1100, releaseYear: 2021 }
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
