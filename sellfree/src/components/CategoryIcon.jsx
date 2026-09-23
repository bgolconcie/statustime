import { Smartphone, Tablet } from 'lucide-react'

const ICONS = { phones: Smartphone, tablets: Tablet }

export default function CategoryIcon({ category, ...props }) {
  const Icon = ICONS[category] ?? Smartphone
  return <Icon {...props} />
}
