import { FlaskConical, RotateCcw } from 'lucide-react'
import { DEMO_PASSWORD, DEMO_USERS } from '@/lib/demoData'
import { useI18n } from '@/i18n'
import { api, resetDemo, setToken } from './api'

const TEXT = {
  en: {
    note: 'Demo — everything you do stays in this browser.',
    signInAs: 'Sign in as',
    reset: 'Reset demo',
  },
  he: {
    note: 'הדגמה — כל מה שתעשו נשמר רק בדפדפן הזה.',
    signInAs: 'כניסה בתור',
    reset: 'איפוס ההדגמה',
  },
}

async function signInAs(email) {
  // Go through the normal login so the demo behaves like the app
  const { token } = await api('/auth/login', { method: 'POST', body: { email, password: DEMO_PASSWORD } })
  setToken(token)
  window.location.reload()
}

export default function DemoBanner() {
  const { lang } = useI18n()
  const text = TEXT[lang] ?? TEXT.en

  return (
    <div className="border-b bg-muted/60 text-xs">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-2">
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <FlaskConical className="size-3.5" />
          {text.note}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">{text.signInAs}</span>
          {DEMO_USERS.map((u) => (
            <button
              key={u.key}
              type="button"
              onClick={() => signInAs(u.email)}
              className="rounded-md border bg-background px-2 py-0.5 font-medium hover:bg-accent"
            >
              {u.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              resetDemo()
              window.location.reload()
            }}
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            {text.reset}
          </button>
        </div>
      </div>
    </div>
  )
}
