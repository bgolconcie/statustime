import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Globe, LogOut, MessageCircle, Plus, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/i18n'

function useUnreadCount(user) {
  const [unread, setUnread] = useState(0)
  const location = useLocation()

  useEffect(() => {
    if (!user) return setUnread(0)
    let active = true
    const refresh = () =>
      api('/conversations/unread')
        .then((d) => active && setUnread(d.unread))
        .catch(() => {})
    refresh()
    const timer = setInterval(refresh, 10_000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [user, location.pathname])

  return unread
}

export default function Header() {
  const { t, lang, setLang } = useI18n()
  const { user, logout } = useAuth()
  const unread = useUnreadCount(user)

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <ShoppingBag className="size-5" />
          SellFree
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={() => setLang(lang === 'he' ? 'en' : 'he')}>
            <Globe />
            <span className="hidden sm:inline">{t('lang.switch')}</span>
          </Button>
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <NavLink to="/messages">
                  <MessageCircle />
                  <span className="hidden sm:inline">{t('nav.messages')}</span>
                  {unread > 0 && <Badge className="h-5 min-w-5 rounded-full px-1.5">{unread}</Badge>}
                </NavLink>
              </Button>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                <NavLink to="/my-listings">{t('nav.myListings')}</NavLink>
              </Button>
              <Button size="sm" asChild>
                <NavLink to="/sell">
                  <Plus />
                  <span className="hidden sm:inline">{t('nav.sell')}</span>
                </NavLink>
              </Button>
              <Button variant="ghost" size="icon" onClick={logout} title={t('nav.logout')} aria-label={t('nav.logout')}>
                <LogOut className="rtl:-scale-x-100" />
              </Button>
            </>
          ) : (
            <Button size="sm" asChild>
              <NavLink to="/login">{t('nav.login')}</NavLink>
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
