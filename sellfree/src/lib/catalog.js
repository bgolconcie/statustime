// SellFree is only for second-hand phones, computers and TVs
export const CATEGORIES = ['phones', 'computers', 'tvs']

export const CONDITIONS = ['new', 'likeNew', 'good', 'fair', 'forParts']

// Screenshots a phone seller must attach so buyers can judge the price
export const PHONE_PROOFS = ['modelStorage', 'purchaseDate', 'condition', 'battery', 'diagnostics']

// Suggestions only; sellers can type any brand
export const BRANDS = {
  phones: ['Apple', 'Samsung', 'Xiaomi', 'Google', 'OnePlus', 'Motorola', 'Nokia'],
  computers: ['Apple', 'Lenovo', 'HP', 'Dell', 'Asus', 'Acer', 'Microsoft', 'MSI'],
  tvs: ['Samsung', 'LG', 'Sony', 'TCL', 'Hisense', 'Philips', 'Xiaomi'],
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
