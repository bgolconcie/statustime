// Sample users, listings and a conversation, shared by the server seed and the in-browser demo
import { COVER_PROOF, PROOF_IDS } from './catalog.js'
import { devicePhoto, mockScreenshot } from './mockImages.js'

export const DEMO_PASSWORD = 'demo1234'

export const DEMO_USERS = [
  { key: 'dana', name: 'Dana', email: 'dana@sellfree.test' },
  { key: 'yossi', name: 'Yossi', email: 'yossi@sellfree.test' },
]

// The 8 images a seller would have attached, drawn to match each sample device
function demoProofs({ category, brand, model, look }, facts) {
  const [year, month] = facts.purchaseDate.split('-').map(Number)
  const purchased = `${new Date(year, month - 1).toLocaleString('en', { month: 'short' })} ${year}`
  const genuine = facts.nonGenuineParts?.length ? 'Unknown Part' : 'Genuine Part'
  const images = {
    deviceInfo: mockScreenshot('About', [['Model Name', `${brand} ${model}`], ['Model Number', facts.modelNumber ?? '—'], ['Capacity', facts.storageGb ? `${facts.storageGb} GB` : '—']]),
    partsLock: mockScreenshot('About', [['Carrier Lock', 'No SIM restrictions'], ['Battery', genuine], ['Display', genuine]]),
    battery: facts.batteryHealthPct == null
      ? mockScreenshot('Battery', [['Battery Usage', 'Last 24 Hours'], ['Low Power Mode', 'Off']])
      : mockScreenshot('Battery Health', [['Maximum Capacity', `${facts.batteryHealthPct}%`], ['Peak Performance', 'Normal']]),
    purchaseDate: mockScreenshot('AppleCare & Warranty', [['Purchase Date', purchased], ['Limited Warranty', 'Expired']]),
    screenOn: devicePhoto(category, 'screenOn', look),
    screenOff: devicePhoto(category, 'screenOff', look),
    back: devicePhoto(category, 'back', look),
    box: facts.includesBox ? devicePhoto(category, 'box', look) : null,
  }
  return PROOF_IDS.filter((kind) => images[kind]).map((kind) => ({ kind, image: images[kind] }))
}

const listing = (seller, category, brand, model, [en, he], [dEn, dHe], condition, price, ageGroups, look = {}) => ({
  seller, category, brand, model, condition, price, ageGroups, look,
  title: he,
  description: dHe,
  i18n: { title: { en, he }, description: { en: dEn, he: dHe } },
})

// Facts as if the AI read them from each demo device's screenshots and photo
function device({ look, ...item }, facts) {
  const full = {
    brand: item.brand, model: item.model, modelNumber: null, ramGb: null, batteryCycles: null,
    nonGenuineParts: [], diagnosticsPassed: true, networkLocked: false, includesBox: false, includesCable: false,
    screenCondition: 'lightScratches', bodyCondition: 'lightWear', problems: [], confidence: 'high', issues: [], ...facts,
  }
  const proofs = demoProofs({ ...item, look }, full)
  return { ...item, image: proofs.find((p) => p.kind === COVER_PROOF).image, proofs, facts: full }
}

// Newest first; prices in shekels
export const DEMO_LISTINGS = [
  device(
    listing('dana', 'phones', 'Apple', 'iPhone 13', ['iPhone 13, 128GB, blue', 'iPhone 13, 128GB, כחול'], ['Battery 87%, always used with a case.', 'סוללה 87%, תמיד היה עם כיסוי.'], 'likeNew', 1900, ['teens', 'adults'], { body: '#1e3a5f' }),
    { modelNumber: 'A2633', ramGb: 4, storageGb: 128, purchaseDate: '2022-03', batteryHealthPct: 87, batteryCycles: 512, launchPriceIls: 3700, releaseYear: 2021, screenCondition: 'flawless', includesBox: true, includesCable: true }
  ),
  device(
    listing('dana', 'phones', 'Samsung', 'Galaxy A14', ['Samsung Galaxy A14 — great first phone', 'Samsung Galaxy A14 — טלפון ראשון מעולה'], ['Simple and durable, parental controls set up.', 'פשוט ועמיד, מוגדרות הגבלות הורים.'], 'good', 450, ['kids', 'teens'], { body: '#111827' }),
    { modelNumber: 'SM-A145F', ramGb: 4, storageGb: 64, purchaseDate: '2024-01', batteryHealthPct: 94, launchPriceIls: 900, releaseYear: 2023, includesCable: true }
  ),
  device(
    listing('yossi', 'tablets', 'Apple', 'iPad (9th generation)', ['iPad 9th gen, 64GB, Wi‑Fi', 'אייפד דור 9, 64GB, Wi‑Fi'], ['With a keyboard case. Great for school.', 'כולל כיסוי עם מקלדת. מעולה ללימודים.'], 'good', 900, ['kids', 'teens', 'adults'], { body: '#9ca3af' }),
    { modelNumber: 'A2602', ramGb: 3, storageGb: 64, purchaseDate: '2022-11', batteryHealthPct: null, launchPriceIls: 1600, releaseYear: 2021, includesBox: true, includesCable: true }
  ),
  device(
    listing('yossi', 'tablets', 'Samsung', 'Galaxy Tab A8', ['Samsung Galaxy Tab A8, 32GB', 'Samsung Galaxy Tab A8, 32GB'], ['Kids profile set up, comes with a sturdy case.', 'מוגדר פרופיל ילדים, מגיע עם כיסוי עמיד.'], 'good', 450, ['kids'], { body: '#374151' }),
    { modelNumber: 'SM-X200', ramGb: 3, storageGb: 32, purchaseDate: '2023-06', batteryHealthPct: 88, launchPriceIls: 1000, releaseYear: 2022, bodyCondition: 'heavyWear' }
  ),
  device(
    listing('yossi', 'phones', 'Nokia', '105', ['Nokia 105 — basic phone, large keys', 'Nokia 105 — טלפון בסיסי עם מקשים גדולים'], ['Long battery life, easy to use.', 'סוללה שמחזיקה הרבה, קל לשימוש.'], 'new', 120, ['seniors'], { body: '#1d4ed8' }),
    { modelNumber: 'TA-1174', storageGb: null, purchaseDate: '2025-08', batteryHealthPct: 100, launchPriceIls: 130, releaseYear: 2019, screenCondition: 'flawless', bodyCondition: 'flawless', includesBox: true, includesCable: true }
  ),
  device(
    listing('dana', 'phones', 'Xiaomi', 'Redmi Note 10', ['Xiaomi Redmi Note 10, cracked screen', 'Xiaomi Redmi Note 10, מסך סדוק'], ['Works, but the screen is cracked. For parts or repair.', 'עובד, אבל המסך סדוק. לחלקים או לתיקון.'], 'forParts', 150, ['adults'], { body: '#0f172a', cracked: true }),
    {
      modelNumber: 'M2101K7AG', ramGb: 4, storageGb: 128, purchaseDate: '2021-06', batteryHealthPct: 79, launchPriceIls: 1100, releaseYear: 2021,
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
