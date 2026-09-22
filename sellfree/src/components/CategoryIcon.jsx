import { Laptop, Smartphone, Tv } from 'lucide-react'

const ICONS = { phones: Smartphone, computers: Laptop, tvs: Tv }

export default function CategoryIcon({ category, ...props }) {
  const Icon = ICONS[category] ?? Smartphone
  return <Icon {...props} />
}
