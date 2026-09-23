import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import OrDivider from '@/components/OrDivider'
import { useI18n } from '@/i18n'

// The demo page can't reach Google, so this stands in for Google's button
export default function GoogleButton({ onCredential }) {
  const { t } = useI18n()
  return (
    <div className="grid gap-4">
      <Button type="button" variant="outline" className="w-full" onClick={() => onCredential('demo')}>
        <Mail />
        {t('auth.googleSimulated')}
      </Button>
      <OrDivider />
    </div>
  )
}
