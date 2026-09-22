import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import ListingCard from '@/components/ListingCard'
import { useStore } from '@/lib/store'

export default function MyListings() {
  const { listings, removeListing } = useStore()
  const mine = listings.filter((l) => l.mine)

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">My listings</h1>
          <p className="text-muted-foreground">
            {mine.length} {mine.length === 1 ? 'item' : 'items'} listed · no limit
          </p>
        </div>
        <Button asChild>
          <Link to="/sell">
            <Plus />
            Sell an item
          </Link>
        </Button>
      </div>

      {mine.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((item) => (
            <ListingCard
              key={item.id}
              item={item}
              action={
                <Button variant="outline" size="sm" onClick={() => removeListing(item.id)}>
                  <Trash2 />
                  Remove
                </Button>
              }
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            You haven't listed anything yet. Got things you don't need? Sell them here.
          </CardContent>
        </Card>
      )}
    </main>
  )
}
