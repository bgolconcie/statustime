export const CATEGORIES = ['clothing', 'toys', 'books', 'electronics', 'furniture', 'sports', 'other']

export const CONDITIONS = ['new', 'likeNew', 'good', 'fair']

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
