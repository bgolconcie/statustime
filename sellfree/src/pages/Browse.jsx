import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import PageState from '@/components/PageState'
import ListingCard from '@/components/ListingCard'
import CategoryIcon from '@/components/CategoryIcon'
import { CATEGORIES } from '@/lib/catalog'
import { api } from '@/lib/api'
import { useI18n } from '@/i18n'

export default function Browse() {
  const { t, listingText, errorText } = useI18n()
  const [listings, setListings] = useState(null)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')

  useEffect(() => {
    api('/listings')
      .then((d) => setListings(d.listings))
      .catch(setError)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (listings ?? [])
      .filter(
        (l) =>
          (category === 'All' || l.category === category) &&
          (!q || [listingText(l, 'title'), listingText(l, 'description'), l.brand, l.model].some((s) => s?.toLowerCase().includes(q)))
      )
  }, [listings, query, category, listingText])

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('browse.title')}</h1>
        <p className="text-muted-foreground">{t('browse.subtitle')}</p>
      </div>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('search.placeholder')} className="ps-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {['All', ...CATEGORIES].map((c) => (
            <Button key={c} size="sm" variant={c === category ? 'default' : 'outline'} onClick={() => setCategory(c)}>
              {c !== 'All' && <CategoryIcon category={c} />}
              {c === 'All' ? t('filter.all') : t(`category.${c}`)}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <PageState>{errorText(error)}</PageState>
      ) : !listings ? (
        <PageState>{t('common.loading')}</PageState>
      ) : results.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <PageState>{t('browse.empty')}</PageState>
      )}
    </main>
  )
}
