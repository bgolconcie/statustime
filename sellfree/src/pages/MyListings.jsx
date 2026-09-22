import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ListingCard from '@/components/ListingCard'
import PageState from '@/components/PageState'
import { api } from '@/lib/api'
import { useI18n } from '@/i18n'

export default function MyListings() {
  const { t, errorText } = useI18n()
  const [mine, setMine] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api('/listings?mine=1')
      .then((d) => setMine(d.listings))
      .catch(setError)
  }, [])

  const toggleSold = async (item) => {
    try {
      const { listing } = await api(`/listings/${item.id}`, {
        method: 'PATCH',
        body: { status: item.status === 'sold' ? 'available' : 'sold' },
      })
      setMine((list) => list.map((l) => (l.id === listing.id ? listing : l)))
    } catch (err) {
      setError(err)
    }
  }

  const remove = async (item) => {
    try {
      await api(`/listings/${item.id}`, { method: 'DELETE' })
      setMine((list) => list.filter((l) => l.id !== item.id))
    } catch (err) {
      setError(err)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t('mine.title')}</h1>
          {mine && (
            <p className="text-muted-foreground">
              {mine.length === 1 ? t('mine.countOne') : t('mine.count', { count: mine.length })}
            </p>
          )}
        </div>
        <Button asChild>
          <Link to="/sell">
            <Plus />
            {t('nav.sell')}
          </Link>
        </Button>
      </div>

      {error ? (
        <PageState>{errorText(error)}</PageState>
      ) : !mine ? (
        <PageState>{t('common.loading')}</PageState>
      ) : mine.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((item) => (
            <ListingCard
              key={item.id}
              item={item}
              action={
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleSold(item)}>
                    {item.status === 'sold' ? t('mine.markAvailable') : t('mine.markSold')}
                  </Button>
                  <Button variant="outline" size="icon" className="size-8" onClick={() => remove(item)} title={t('mine.remove')} aria-label={t('mine.remove')}>
                    <Trash2 />
                  </Button>
                </div>
              }
            />
          ))}
        </div>
      ) : (
        <PageState>{t('mine.empty')}</PageState>
      )}
    </main>
  )
}
