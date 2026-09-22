import { useMemo, useState } from 'react'
import { Search, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import ListingCard from '@/components/ListingCard'
import { CATEGORIES, ageGroupFor } from '@/lib/catalog'
import { useStore } from '@/lib/store'

function AgePanel({ age, setAge, group, onlyMatched, setOnlyMatched }) {
  return (
    <Card className="mb-6 gap-0 py-4">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-muted">
            <UserRound className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium">Shopping for age</p>
            <p className="text-xs text-muted-foreground">
              {group ? `Showing items for ${group.label} (${group.range})` : 'Enter an age to get matched items'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={120}
            placeholder="Age"
            className="w-24"
            value={age}
            onChange={(e) => setAge(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
          />
          {group && (
            <Button variant="outline" size="sm" onClick={() => setOnlyMatched(!onlyMatched)}>
              {onlyMatched ? 'Show all ages' : 'Only my age'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function Browse() {
  const { listings, age, setAge } = useStore()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [onlyMatched, setOnlyMatched] = useState(true)
  const group = ageGroupFor(age)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return listings
      .map((l) => ({ ...l, matched: !!group && l.ageGroups.includes(group.id) }))
      .filter(
        (l) =>
          (category === 'All' || l.category === category) &&
          (!q || l.title.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q)) &&
          (!group || !onlyMatched || l.matched)
      )
      .sort((a, b) => Number(b.matched) - Number(a.matched))
  }, [listings, query, category, group, onlyMatched])

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Find things people no longer need</h1>
        <p className="text-muted-foreground">Second-hand items, matched to the age you're shopping for.</p>
      </div>

      <AgePanel age={age} setAge={setAge} group={group} onlyMatched={onlyMatched} setOnlyMatched={setOnlyMatched} />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search items" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {['All', ...CATEGORIES].map((c) => (
            <Button key={c} size="sm" variant={c === category ? 'default' : 'outline'} onClick={() => setCategory(c)}>
              {c}
            </Button>
          ))}
        </div>
      </div>

      {results.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((item) => (
            <ListingCard key={item.id} item={item} matched={item.matched} action={<Button size="sm">Contact seller</Button>} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">No items match your filters.</CardContent>
        </Card>
      )}
    </main>
  )
}
