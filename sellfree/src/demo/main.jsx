// Entry for the shareable demo: the real app, with an in-browser server and no build-time fonts
import React from 'react'
import ReactDOM from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '../index.css'
import App from '../App'
import { I18nProvider } from '../i18n'
import DemoBanner from './DemoBanner'

// Follow the viewer's theme: an explicit data-theme wins, otherwise the system setting
function syncTheme() {
  const root = document.documentElement
  const chosen = root.dataset.theme
  const dark = chosen ? chosen === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  root.classList.toggle('dark', dark)
}
syncTheme()
new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <MemoryRouter>
        <DemoBanner />
        <App />
      </MemoryRouter>
    </I18nProvider>
  </React.StrictMode>
)
