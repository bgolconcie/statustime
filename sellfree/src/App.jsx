import { Route, Routes } from 'react-router-dom'
import Header from '@/components/Header'
import Browse from '@/pages/Browse'
import Sell from '@/pages/Sell'
import MyListings from '@/pages/MyListings'
import { StoreProvider } from '@/lib/store'

export default function App() {
  return (
    <StoreProvider>
      <div className="min-h-screen">
        <Header />
        <Routes>
          <Route path="/" element={<Browse />} />
          <Route path="/sell" element={<Sell />} />
          <Route path="/my-listings" element={<MyListings />} />
        </Routes>
      </div>
    </StoreProvider>
  )
}
