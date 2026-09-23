// SellFree is only for second-hand phones and tablets
export const CATEGORIES = ['phones', 'tablets']

export const CONDITIONS = ['new', 'likeNew', 'good', 'fair', 'forParts']

// The images a seller attaches for the AI device check, in the order they're asked for
export const PROOF_SLOTS = [
  { id: 'deviceInfo', type: 'screenshot', required: true },
  { id: 'partsLock', type: 'screenshot', required: true },
  { id: 'battery', type: 'screenshot', required: true },
  { id: 'purchaseDate', type: 'screenshot', required: true },
  { id: 'screenOn', type: 'photo', required: true },
  { id: 'screenOff', type: 'photo', required: true },
  { id: 'back', type: 'photo', required: true },
  { id: 'box', type: 'photo', required: false },
]
export const PROOF_IDS = PROOF_SLOTS.map((s) => s.id)
export const REQUIRED_PROOFS = PROOF_SLOTS.filter((s) => s.required).map((s) => s.id)

// The "Scratch Check" photo doubles as the listing's cover photo
export const COVER_PROOF = 'screenOff'

// Phones and tablets (iPad etc.) need those screenshots and get a price check
export const needsProofs = (category) => category === 'phones' || category === 'tablets'

// Suggestions only; sellers can type any brand
export const BRANDS = {
  phones: ['Apple', 'Samsung', 'Xiaomi', 'Google', 'OnePlus', 'Motorola', 'Nokia'],
  tablets: ['Apple', 'Samsung', 'Lenovo', 'Xiaomi', 'Huawei', 'Microsoft'],
}

export const AGE_GROUPS = [
  { id: 'baby', min: 0, max: 2 },
  { id: 'kids', min: 3, max: 12 },
  { id: 'teens', min: 13, max: 17 },
  { id: 'adults', min: 18, max: 64 },
  { id: 'seniors', min: 65, max: Infinity },
]

export function ageGroupFor(age) {
  if (age === '' || age == null || Number.isNaN(Number(age))) return null
  return AGE_GROUPS.find((g) => age >= g.min && age <= g.max) ?? null
}
