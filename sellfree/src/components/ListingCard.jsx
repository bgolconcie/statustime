import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import CategoryIcon from '@/components/CategoryIcon'
import { needsProofs } from '@/lib/catalog'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

export default function ListingCard({ item, action }) {
  const { t, listingText, formatPrice } = useI18n()
  const title = listingText(item, 'title')
  const description = listingText(item, 'description')
  const sold = item.status === 'sold'

  return (
    <Card className="gap-4 overflow-hidden pt-0">
      <Link to={`/listing/${item.id}`} className="group flex flex-1 flex-col gap-4">
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted">
          {item.image ? (
            <img src={item.image} alt={title} className={cn('size-full object-cover transition-transform group-hover:scale-[1.02]', sold && 'opacity-50')} />
          ) : (
            <CategoryIcon category={item.category} className="size-10 text-muted-foreground/40" />
          )}
          {sold && (
            <Badge variant="secondary" className="absolute end-3 top-3">
              {t('listing.sold')}
            </Badge>
          )}
        </div>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{t(`category.${item.category}`)}</Badge>
            <Badge variant="outline">{t(`condition.${item.condition}`)}</Badge>
            {needsProofs(item.category) && item.proofCount > 0 && (
              <Badge variant="outline" className="border-green-600/30 text-green-700">
                <ShieldCheck />
                {t('proofs.badge')}
              </Badge>
            )}
          </div>
          <CardTitle dir="auto" className="pt-2 text-start group-hover:underline">{title}</CardTitle>
          {(item.brand || item.model) && (
            <p dir="auto" className="text-start text-sm font-medium text-muted-foreground">
              {[item.brand, item.model].filter(Boolean).join(' · ')}
            </p>
          )}
          {description && <CardDescription dir="auto" className="line-clamp-2 text-start">{description}</CardDescription>}
        </CardHeader>
      </Link>
      <CardFooter className="justify-between gap-2">
        <span className="text-lg font-semibold">{formatPrice(item.price, item.currency)}</span>
        {action ?? <span className="text-sm text-muted-foreground">{item.sellerName}</span>}
      </CardFooter>
    </Card>
  )
}
