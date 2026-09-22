import { createContext, useContext, useEffect, useState } from 'react'

// Local-only persistence until there is a backend
// v2: categories/conditions stored as ids, listings carry their currency
const LISTINGS_KEY = 'sellfree.listings.v2'
const AGE_KEY = 'sellfree.age'

const SEED = [
  { id: 's1', title: { en: 'Wooden stacking blocks', he: 'קוביות עץ להרכבה' }, description: { en: '30 blocks, natural wood.', he: '30 קוביות, עץ טבעי.' }, category: 'toys', condition: 'good', price: 12, ageGroups: ['baby', 'kids'] },
  { id: 's2', title: { en: 'Kids bike 16"', he: 'אופני ילדים 16 אינץ\'' }, description: { en: 'Training wheels included.', he: 'כולל גלגלי עזר.' }, category: 'sports', condition: 'likeNew', price: 60, ageGroups: ['kids'] },
  { id: 's3', title: { en: 'Harry Potter box set', he: 'סדרת הארי פוטר' }, description: { en: 'All 7 books, paperback.', he: 'כל 7 הספרים, כריכה רכה.' }, category: 'books', condition: 'good', price: 35, ageGroups: ['kids', 'teens', 'adults'] },
  { id: 's4', title: { en: 'Gaming headset', he: 'אוזניות גיימינג' }, description: { en: 'Wired, USB + 3.5mm.', he: 'חוטיות, USB ו-3.5 מ"מ.' }, category: 'electronics', condition: 'likeNew', price: 40, ageGroups: ['teens', 'adults'] },
  { id: 's5', title: { en: 'Office chair', he: 'כיסא משרדי' }, description: { en: 'Free, pick up only.', he: 'בחינם, איסוף עצמי בלבד.' }, category: 'furniture', condition: 'fair', price: 0, ageGroups: ['adults', 'seniors'] },
  { id: 's6', title: { en: 'Baby clothes bundle 6–12m', he: 'חבילת בגדי תינוקות 6–12 חודשים' }, description: { en: '15 pieces, mostly cotton.', he: '15 פריטים, רובם כותנה.' }, category: 'clothing', condition: 'good', price: 20, ageGroups: ['baby'] },
  { id: 's7', title: { en: 'Large-print crossword books', he: 'חוברות תשבצים באותיות גדולות' }, description: { en: 'Set of 3, unused.', he: 'סט של 3, לא בשימוש.' }, category: 'books', condition: 'new', price: 8, ageGroups: ['seniors'] },
].map((l) => ({ ...l, currency: 'USD', mine: false }))

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked — keep working in memory
  }
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [listings, setListings] = useState(() => load(LISTINGS_KEY, SEED))
  const [age, setAge] = useState(() => load(AGE_KEY, ''))

  useEffect(() => save(LISTINGS_KEY, listings), [listings])
  useEffect(() => save(AGE_KEY, age), [age])

  // No cap on how many items a seller can list
  const addListing = (listing) =>
    setListings((prev) => [{ ...listing, id: crypto.randomUUID(), mine: true, createdAt: Date.now() }, ...prev])

  const removeListing = (id) => setListings((prev) => prev.filter((l) => l.id !== id))

  return (
    <StoreContext.Provider value={{ listings, addListing, removeListing, age, setAge }}>{children}</StoreContext.Provider>
  )
}

export function useStore() {
  return useContext(StoreContext)
}
