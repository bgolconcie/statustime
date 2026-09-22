import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ImageIcon, MessageCircle, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { AgeGroupsText } from '@/components/ListingCard'
import PageState from '@/components/PageState'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/i18n'

export default function ListingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, errorText, listingText, formatPrice, formatTime } = useI18n()
  const [listing, setListing] = useState(null)
  const [error, setError] = useState(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    api(`/listings/${id}`)
      .then((d) => setListing(d.listing))
      .catch(setError)
  }, [id])

  const messageSeller = async () => {
    if (!user) return navigate('/login', { state: { from: `/listing/${id}` } })
    setStarting(true)
    try {
      const { conversationId } = await api(`/listings/${id}/conversations`, { method: 'POST' })
      navigate(`/messages/${conversationId}`)
    } catch (err) {
      setError(err)
      setStarting(false)
    }
  }

  const back = (
    <Button variant="ghost" size="sm" className="mb-4 -ms-3" asChild>
      <Link to="/">
        <ArrowLeft className="rtl:-scale-x-100" />
        {t('common.back')}
      </Link>
    </Button>
  )

  if (error || !listing) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        {back}
        <PageState>{error ? (error.code === 'not_found' ? t('listing.notFound') : errorText(error)) : t('common.loading')}</PageState>
      </main>
    )
  }

  const title = listingText(listing, 'title')
  const description = listingText(listing, 'description')
  const isMine = user?.id === listing.sellerId
  const sold = listing.status === 'sold'

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {back}
      <Card className="gap-0 overflow-hidden py-0 md:grid md:grid-cols-2">
        <div className="flex aspect-square items-center justify-center bg-muted">
          {listing.image ? (
            <img src={listing.image} alt={title} className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-10 text-muted-foreground/50" />
          )}
        </div>
        <CardContent className="flex flex-col gap-5 py-6">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{t(`category.${listing.category}`)}</Badge>
            <Badge variant="outline">{t(`condition.${listing.condition}`)}</Badge>
            {sold && <Badge>{t('listing.sold')}</Badge>}
          </div>
          <div className="space-y-2">
            <h1 dir="auto" className="text-start text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-2xl font-semibold">{formatPrice(listing.price, listing.currency)}</p>
          </div>
          {description && <p dir="auto" className="whitespace-pre-line text-start text-muted-foreground">{description}</p>}
          <p className="text-sm text-muted-foreground">
            <AgeGroupsText ageGroups={listing.ageGroups} />
          </p>

          <div className="flex items-center gap-3 rounded-lg border p-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-muted">
              <UserRound className="size-4" />
            </div>
            <div className="text-sm">
              <p className="font-medium">{t('listing.seller', { name: listing.sellerName })}</p>
              <p className="text-muted-foreground">{t('listing.posted', { date: formatTime(listing.createdAt) })}</p>
            </div>
          </div>

          <div className="mt-auto">
            {isMine ? (
              <p className="text-sm text-muted-foreground">{t('listing.yours')}</p>
            ) : (
              <Button size="lg" className="w-full" disabled={sold || starting} onClick={messageSeller}>
                <MessageCircle />
                {user ? t('listing.message') : t('listing.loginToMessage')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
