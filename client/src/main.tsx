// build-v3
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Force light mode — dark mode removed
document.documentElement.removeAttribute('data-theme')
localStorage.removeItem('st_theme')
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
