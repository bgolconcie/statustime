import { Laptop, Smartphone, Tablet, Tv } from 'lucide-react'

const ICONS = { phones: Smartphone, tablets: Tablet, computers: Laptop, tvs: Tv }

export default function CategoryIcon({ category, ...props }) {
  const Icon = ICONS[category] ?? Smartphone
  return <Icon {...props} />
}
