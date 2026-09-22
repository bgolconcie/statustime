import { createContext, useContext, useEffect, useState } from 'react'
import { LANGUAGES, translations } from './translations'

const LANG_KEY = 'sellfree.lang'

// Manual choice wins; otherwise use the first supported browser language
function detectLanguage() {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved in LANGUAGES) return saved
  } catch {
    // Storage blocked — fall through to browser detection
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag?.toLowerCase().split('-')[0]
    if (base === 'iw') return 'he'
    if (base in LANGUAGES) return base
  }
  return 'en'
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLanguage)
  const { dir, locale, currency } = LANGUAGES[lang]

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  const setLang = (next) => {
    setLangState(next)
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {
      // Choice just won't persist
    }
  }

  const t = (key, vars = {}) =>
    (translations[lang][key] ?? translations.en[key] ?? key).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? '')

  // Isolate ranges like "3–12" so RTL text doesn't reorder the numbers
  const ageRange = (id) => `\u2068${t(`ageRange.${id}`)}\u2069`

  const errorText = (err) => {
    const key = `error.${err?.code ?? err}`
    return key in translations.en ? t(key) : t('error.generic')
  }

  // Today: time only; otherwise a short date
  const formatTime = (ms) => {
    const date = new Date(ms)
    const today = date.toDateString() === new Date().toDateString()
    return new Intl.DateTimeFormat(locale, today ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' }).format(date)
  }

  // Listing content can be a plain string (user-written) or { en, he } (seed data)
  const localize = (value) => (typeof value === 'string' ? value : value?.[lang] ?? value?.en ?? '')

  // Seed listings carry both languages in i18n; user listings are shown as written
  const listingText = (listing, field) => localize(listing.i18n?.[field] ?? listing[field])

  const formatPrice = (price, priceCurrency = currency) =>
    price === 0
      ? t('price.free')
      : new Intl.NumberFormat(locale, { style: 'currency', currency: priceCurrency, maximumFractionDigits: 0 }).format(price)

  const currencySymbol = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
    .formatToParts(0)
    .find((p) => p.type === 'currency').value

  return (
    <I18nContext.Provider value={{ lang, setLang, dir, currency, currencySymbol, t, ageRange, errorText, formatTime, localize, listingText, formatPrice }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
