// SellFree is only for second-hand phones, tablets, computers and TVs
export const CATEGORIES = ['phones', 'tablets', 'computers', 'tvs']

export const CONDITIONS = ['new', 'likeNew', 'good', 'fair', 'forParts']

// Screenshots of the device's own data a seller must attach so buyers can judge the price
export const PHONE_PROOFS = ['modelStorage', 'purchaseDate', 'network', 'battery', 'diagnostics']

// Phones and tablets (iPad etc.) need those screenshots and get a price check
export const needsProofs = (category) => category === 'phones' || category === 'tablets'

// Suggestions only; sellers can type any brand
export const BRANDS = {
  phones: ['Apple', 'Samsung', 'Xiaomi', 'Google', 'OnePlus', 'Motorola', 'Nokia'],
  tablets: ['Apple', 'Samsung', 'Lenovo', 'Xiaomi', 'Huawei', 'Microsoft'],
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
