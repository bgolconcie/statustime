import { Link, NavLink } from 'react-router-dom'
import { Plus, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Header() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <ShoppingBag className="size-5" />
          SellFree
        </Link>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <NavLink to="/my-listings">My listings</NavLink>
          </Button>
          <Button size="sm" asChild>
            <NavLink to="/sell">
              <Plus />
              Sell an item
            </NavLink>
          </Button>
        </nav>
      </div>
    </header>
  )
}
