import { Card, CardContent } from '@/components/ui/card'

export default function PageState({ children }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-muted-foreground">{children}</CardContent>
    </Card>
  )
}
