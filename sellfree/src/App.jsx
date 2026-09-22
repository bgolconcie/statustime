import { useMemo, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { Search, ShoppingBag, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { categories, listings } from '@/data/listings'

function Header() {
  return (
    <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <ShoppingBag className="size-5" />
          SellFree
        </Link>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm">Sell</Button>
          <Button size="sm">Sign in</Button>
        </nav>
      </div>
    </header>
  )
}

function ListingCard({ item }) {
  return (
    <Card className="gap-4">
      <div className="mx-6 aspect-[4/3] rounded-lg bg-muted" />
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{item.category}</Badge>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Star className="size-3.5 fill-current" />
            {item.rating}
          </span>
        </div>
        <CardTitle className="pt-2">{item.title}</CardTitle>
        <CardDescription>by {item.seller}</CardDescription>
      </CardHeader>
      <CardFooter className="justify-between">
        <span className="text-lg font-semibold">${item.price}</span>
        <Button size="sm">Buy</Button>
      </CardFooter>
    </Card>
  )
}

function Browse() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return listings.filter(
      (l) =>
        (category === 'All' || l.category === category) &&
        (!q || l.title.toLowerCase().includes(q) || l.seller.toLowerCase().includes(q))
    )
  }, [query, category])

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Discover digital products</h1>
        <p className="text-muted-foreground">Templates, kits and tools from independent creators.</p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products or sellers"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={c === category ? 'default' : 'outline'}
              onClick={() => setCategory(c)}
            >
              {c}
            </Button>
          ))}
        </div>
      </div>

      {results.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">No products match your search.</CardContent>
        </Card>
      )}
    </main>
  )
}

export default function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <Routes>
        <Route path="/" element={<Browse />} />
      </Routes>
    </div>
  )
}
