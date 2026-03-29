import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Login } from './pages/Login'
import { AppLayout } from './components/layout/AppLayout'
import { Overview } from './pages/dashboard/Overview'
import { TeamHours } from './pages/dashboard/TeamHours'
import { Leave } from './pages/dashboard/Leave'
import { Integrations } from './pages/dashboard/Integrations'
import { Reports } from './pages/dashboard/Reports'
import { UserDetail } from './pages/UserDetail'
import { useTheme } from './hooks/useTheme'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return localStorage.getItem('st_token') ? <>{children}</> : <Navigate to="/" replace />
}

export default function App() {
  useTheme()
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route index element={<Overview />} />
          <Route path="team" element={<TeamHours />} />
          <Route path="leave" element={<Leave />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="reports" element={<Reports />} />
          <Route path="user/:id" element={<UserDetail />} />
        </Route>
        <Route path="/user/:id" element={<Navigate to="/dashboard/user/:id" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
