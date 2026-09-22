import { Route, Routes } from 'react-router-dom'
import Header from '@/components/Header'
import Browse from '@/pages/Browse'
import ListingDetail from '@/pages/ListingDetail'
import Login from '@/pages/Login'
import Sell from '@/pages/Sell'
import MyListings from '@/pages/MyListings'
import Messages from '@/pages/Messages'
import { AuthProvider, RequireAuth } from '@/lib/auth'

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen">
        <Header />
        <Routes>
          <Route path="/" element={<Browse />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/sell" element={<RequireAuth><Sell /></RequireAuth>} />
          <Route path="/my-listings" element={<RequireAuth><MyListings /></RequireAuth>} />
          <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
          <Route path="/messages/:id" element={<RequireAuth><Messages /></RequireAuth>} />
        </Routes>
      </div>
    </AuthProvider>
  )
}
