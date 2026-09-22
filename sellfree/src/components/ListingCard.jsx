import { ImageIcon, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AGE_GROUPS } from '@/lib/catalog'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

export default function ListingCard({ item, matched, action }) {
  const { t, ageRange, localize, formatPrice } = useI18n()
  const groups = AGE_GROUPS.filter((g) => item.ageGroups.includes(g.id))
  const title = localize(item.title)
  const description = localize(item.description)

  return (
    <Card className={cn('gap-4 overflow-hidden pt-0', matched && 'ring-2 ring-primary/20')}>
      <div className="relative flex aspect-[4/3] items-center justify-center bg-muted">
        {item.image ? (
          <img src={item.image} alt={title} className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-8 text-muted-foreground/50" />
        )}
        {matched && (
          <Badge className="absolute start-3 top-3">
            <Sparkles />
            {t('card.yourAge')}
          </Badge>
        )}
      </div>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{t(`category.${item.category}`)}</Badge>
          <Badge variant="outline">{t(`condition.${item.condition}`)}</Badge>
        </div>
        <CardTitle className="pt-2">{title}</CardTitle>
        {description && <CardDescription className="line-clamp-2">{description}</CardDescription>}
        <p className="text-xs text-muted-foreground">
          {t('card.forAges', {
            groups:
              groups.length === AGE_GROUPS.length
                ? t('card.allAges')
                : groups.map((g) => `${t(`ageGroup.${g.id}`)} (${ageRange(g.id)})`).join(', '),
          })}
        </p>
      </CardHeader>
      <CardFooter className="mt-auto justify-between">
        <span className="text-lg font-semibold">{formatPrice(item.price, item.currency)}</span>
        {action}
      </CardFooter>
    </Card>
  )
}
