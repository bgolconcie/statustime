import { useEffect, useMemo, useState } from 'react'
import { Search, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import PageState from '@/components/PageState'
import ListingCard from '@/components/ListingCard'
import { CATEGORIES, ageGroupFor } from '@/lib/catalog'
import { api } from '@/lib/api'
import { useI18n } from '@/i18n'

function AgePanel({ age, setAge, group, onlyMatched, setOnlyMatched }) {
  const { t, ageRange } = useI18n()
  return (
    <Card className="mb-6 gap-0 py-4">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-muted">
            <UserRound className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium">{t('age.heading')}</p>
            <p className="text-xs text-muted-foreground">
              {group
                ? t('age.showing', { group: t(`ageGroup.${group.id}`), range: ageRange(group.id) })
                : t('age.prompt')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={120}
            placeholder={t('age.placeholder')}
            className="w-24"
            value={age}
            onChange={(e) => setAge(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
          />
          {group && (
            <Button variant="outline" size="sm" onClick={() => setOnlyMatched(!onlyMatched)}>
              {onlyMatched ? t('age.showAll') : t('age.onlyMine')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const AGE_KEY = 'sellfree.age'

function useSavedAge() {
  const [age, setAge] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(AGE_KEY)) ?? ''
    } catch {
      return ''
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(AGE_KEY, JSON.stringify(age))
    } catch {
      // Age just won't be remembered
    }
  }, [age])
  return [age, setAge]
}

export default function Browse() {
  const { t, listingText, errorText } = useI18n()
  const [listings, setListings] = useState(null)
  const [error, setError] = useState(null)
  const [age, setAge] = useSavedAge()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [onlyMatched, setOnlyMatched] = useState(true)
  const group = ageGroupFor(age)

  useEffect(() => {
    api('/listings')
      .then((d) => setListings(d.listings))
      .catch(setError)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (listings ?? [])
      .map((l) => ({ ...l, matched: !!group && l.ageGroups.includes(group.id) }))
      .filter(
        (l) =>
          (category === 'All' || l.category === category) &&
          (!q || listingText(l, 'title').toLowerCase().includes(q) || listingText(l, 'description').toLowerCase().includes(q)) &&
          (!group || !onlyMatched || l.matched)
      )
      .sort((a, b) => Number(b.matched) - Number(a.matched))
  }, [listings, query, category, group, onlyMatched, listingText])

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('browse.title')}</h1>
        <p className="text-muted-foreground">{t('browse.subtitle')}</p>
      </div>

      <AgePanel age={age} setAge={setAge} group={group} onlyMatched={onlyMatched} setOnlyMatched={setOnlyMatched} />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('search.placeholder')} className="ps-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {['All', ...CATEGORIES].map((c) => (
            <Button key={c} size="sm" variant={c === category ? 'default' : 'outline'} onClick={() => setCategory(c)}>
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
            <ListingCard key={item.id} item={item} matched={item.matched} />
          ))}
        </div>
      ) : (
        <PageState>{t('browse.empty')}</PageState>
      )}
    </main>
  )
}
