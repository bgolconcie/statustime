import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import GoogleButton from '@/components/GoogleButton'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

export default function Login() {
  const { t, errorText } = useI18n()
  const { user, authenticate } = useAuth()
  const navigate = useNavigate()
  const from = useLocation().state?.from ?? '/'
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={from} replace />

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const signInWithGoogle = async (credential) => {
    setBusy(true)
    setError('')
    try {
      await authenticate('google', { credential })
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await authenticate(mode, mode === 'login' ? { email: form.email, password: form.password } : form)
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <form onSubmit={submit}>
        <Card>
          <CardHeader>
            <div className="mb-4 grid grid-cols-2 rounded-lg bg-muted p-1">
              {['login', 'register'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m)
                    setError('')
                  }}
                  className={cn(
                    'rounded-md py-1.5 text-sm font-medium text-muted-foreground transition-colors',
                    mode === m && 'bg-background text-foreground shadow-sm'
                  )}
                >
                  {m === 'login' ? t('auth.loginTab') : t('auth.registerTab')}
                </button>
              ))}
            </div>
            <CardTitle className="text-xl">{mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}</CardTitle>
            <CardDescription>{t('auth.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <GoogleButton onCredential={signInWithGoogle} />
            {mode === 'register' && (
              <div className="grid gap-2">
                <Label htmlFor="name">{t('auth.name')}</Label>
                <Input id="name" autoComplete="name" required value={form.name} onChange={set('name')} />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" type="email" dir="ltr" autoComplete="email" required value={form.email} onChange={set('email')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                dir="ltr"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={mode === 'register' ? 6 : undefined}
                required
                value={form.password}
                onChange={set('password')}
              />
              {mode === 'register' && <p className="text-xs text-muted-foreground">{t('auth.passwordHint')}</p>}
            </div>
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === 'login' ? t('auth.loginTab') : t('auth.registerTitle')}
            </Button>
            {mode === 'login' && <p className="text-center text-xs text-muted-foreground">{t('auth.demo')}</p>}
          </CardFooter>
        </Card>
      </form>
    </main>
  )
}
