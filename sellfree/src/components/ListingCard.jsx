import { ImageIcon, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AGE_GROUPS, formatPrice } from '@/lib/catalog'
import { cn } from '@/lib/utils'

export default function ListingCard({ item, matched, action }) {
  const groups = AGE_GROUPS.filter((g) => item.ageGroups.includes(g.id))

  return (
    <Card className={cn('gap-4 overflow-hidden pt-0', matched && 'ring-2 ring-primary/20')}>
      <div className="relative flex aspect-[4/3] items-center justify-center bg-muted">
        {item.image ? (
          <img src={item.image} alt={item.title} className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-8 text-muted-foreground/50" />
        )}
        {matched && (
          <Badge className="absolute left-3 top-3">
            <Sparkles />
            Your age
          </Badge>
        )}
      </div>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{item.category}</Badge>
          <Badge variant="outline">{item.condition}</Badge>
        </div>
        <CardTitle className="pt-2">{item.title}</CardTitle>
        {item.description && <CardDescription className="line-clamp-2">{item.description}</CardDescription>}
        <p className="text-xs text-muted-foreground">
          For ages: {groups.length === AGE_GROUPS.length ? 'All ages' : groups.map((g) => `${g.label} (${g.range})`).join(', ')}
        </p>
      </CardHeader>
      <CardFooter className="mt-auto justify-between">
        <span className="text-lg font-semibold">{formatPrice(item.price)}</span>
        {action}
      </CardFooter>
    </Card>
  )
}
