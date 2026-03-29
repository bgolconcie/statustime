import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

type Tab = 'login' | 'register'

export function Login() {
  const [tab, setTab] = useState<Tab>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  if (localStorage.getItem('st_token')) { navigate('/dashboard'); return null }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const d = tab === 'login'
        ? await api.login(email, password)
        : await api.register(name, email, password)
      localStorage.setItem('st_token', d.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setLoading(false) }
  }

  const inp: React.CSSProperties = {
    width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '0.75rem 1rem', color: 'var(--text)',
    fontSize: '0.95rem', outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontFamily: 'Inter,sans-serif', fontWeight: 800, fontSize: '1.75rem', color: 'var(--accent)' }}>
            Status<span style={{ color: 'var(--text)' }}>Time</span>
          </div>
          <p style={{ color: 'var(--muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Automatic time tracking via Slack & Teams
          </p>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '2rem', boxShadow: 'var(--shadow)' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 8, padding: 3, marginBottom: '1.5rem' }}>
            {(['login','register'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '0.5rem', border: 'none', borderRadius: 6, cursor: 'pointer',
                fontSize: '0.875rem', fontWeight: t === tab ? 700 : 500, fontFamily: 'inherit',
                background: t === tab ? 'var(--accent)' : 'transparent',
                color: t === tab ? 'var(--bg)' : 'var(--muted)', transition: 'all 0.2s',
              }}>
                {t === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tab === 'register' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>Company name</label>
                <input style={inp} type="text" placeholder="Acme Inc." value={name} onChange={e => setName(e.target.value)} required />
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>Email</label>
              <input style={inp} type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>Password</label>
              <input style={inp} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <p style={{ color: 'var(--red)', fontSize: '0.8rem', margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{
              background: 'var(--accent)', color: 'var(--bg)', border: 'none',
              borderRadius: 8, padding: '0.875rem', fontSize: '1rem', fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
              opacity: loading ? 0.7 : 1,
            }}>
              {loading ? 'Loading...' : tab === 'login' ? 'Log in' : 'Create account →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
