import { createContext, useContext, useEffect, useState } from 'react'

// Local-only persistence until there is a backend
const LISTINGS_KEY = 'sellfree.listings'
const AGE_KEY = 'sellfree.age'

const SEED = [
  { id: 's1', title: 'Wooden stacking blocks', category: 'Toys & Games', condition: 'Good', price: 12, ageGroups: ['baby', 'kids'], description: '30 blocks, natural wood.', mine: false },
  { id: 's2', title: 'Kids bike 16"', category: 'Sports', condition: 'Like new', price: 60, ageGroups: ['kids'], description: 'Training wheels included.', mine: false },
  { id: 's3', title: 'Harry Potter box set', category: 'Books', condition: 'Good', price: 35, ageGroups: ['kids', 'teens', 'adults'], description: 'All 7 books, paperback.', mine: false },
  { id: 's4', title: 'Gaming headset', category: 'Electronics', condition: 'Like new', price: 40, ageGroups: ['teens', 'adults'], description: 'Wired, USB + 3.5mm.', mine: false },
  { id: 's5', title: 'Office chair', category: 'Furniture', condition: 'Fair', price: 0, ageGroups: ['adults', 'seniors'], description: 'Free, pick up only.', mine: false },
  { id: 's6', title: 'Baby clothes bundle 6–12m', category: 'Clothing', condition: 'Good', price: 20, ageGroups: ['baby'], description: '15 pieces, mostly cotton.', mine: false },
  { id: 's7', title: 'Large-print crossword books', category: 'Books', condition: 'New', price: 8, ageGroups: ['seniors'], description: 'Set of 3, unused.', mine: false },
]

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
