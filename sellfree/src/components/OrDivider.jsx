import { useI18n } from '@/i18n'

export default function OrDivider() {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {t('auth.or')}
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
