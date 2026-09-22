export const CATEGORIES = ['Clothing', 'Toys & Games', 'Books', 'Electronics', 'Furniture', 'Sports', 'Other']

export const CONDITIONS = ['New', 'Like new', 'Good', 'Fair']

export const AGE_GROUPS = [
  { id: 'baby', label: 'Baby', range: '0–2', min: 0, max: 2 },
  { id: 'kids', label: 'Kids', range: '3–12', min: 3, max: 12 },
  { id: 'teens', label: 'Teens', range: '13–17', min: 13, max: 17 },
  { id: 'adults', label: 'Adults', range: '18–64', min: 18, max: 64 },
  { id: 'seniors', label: 'Seniors', range: '65+', min: 65, max: Infinity },
]

export function ageGroupFor(age) {
  if (age === '' || age == null || Number.isNaN(Number(age))) return null
  return AGE_GROUPS.find((g) => age >= g.min && age <= g.max) ?? null
}

export function formatPrice(price) {
  return price === 0 ? 'Free' : `$${price}`
}
