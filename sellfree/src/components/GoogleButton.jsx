import { useEffect, useRef, useState } from 'react'
import OrDivider from '@/components/OrDivider'
import { api } from '@/lib/api'
import { useI18n } from '@/i18n'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
let gisLoading

// Google Identity Services, loaded once and only when Google sign-in is configured
function loadGoogle() {
  gisLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = resolve
    script.onerror = () => {
      gisLoading = null
      reject(new Error('Could not load Google sign-in'))
    }
    document.head.appendChild(script)
  })
  return gisLoading
}

// "Continue with Google" rendered by Google; hidden when the server has no GOOGLE_CLIENT_ID
export default function GoogleButton({ onCredential }) {
  const { lang } = useI18n()
  const [clientId, setClientId] = useState(null)
  const container = useRef(null)
  const callback = useRef(onCredential)
  callback.current = onCredential

  useEffect(() => {
    api('/auth/config')
      .then((d) => setClientId(d.googleClientId))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    loadGoogle()
      .then(() => {
        if (cancelled || !container.current) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => callback.current(credential),
        })
        window.google.accounts.id.renderButton(container.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          width: Math.min(container.current.offsetWidth, 400),
          locale: lang,
        })
      })
      .catch(() => setClientId(null))
    return () => {
      cancelled = true
    }
  }, [clientId, lang])

  if (!clientId) return null
  return (
    <div className="grid gap-4">
      <div ref={container} className="flex min-h-10 justify-center" />
      <OrDivider />
    </div>
  )
}
