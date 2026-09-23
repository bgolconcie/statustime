import { useState } from 'react'
import { CheckCircle2, CircleHelp, Loader2, Square, Upload, Volume2, X, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { COVER_PROOF } from '@/lib/catalog'
import { proofExamples } from '@/lib/mockImages'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

function CheckStatus({ check }) {
  const { t } = useI18n()
  if (!check) return null
  if (check.status === 'checking') {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t('proofs.checking')}
      </p>
    )
  }
  if (check.status === 'valid') {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400">
        <CheckCircle2 className="size-4" />
        {t('proofs.valid')}
      </p>
    )
  }
  if (check.status === 'invalid') {
    return (
      <p className="flex items-start gap-1.5 text-sm text-red-700 dark:text-red-400">
        <XCircle className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="font-medium">{t('proofs.retake')}: </span>
          <bdi>{check.reason}</bdi>
        </span>
      </p>
    )
  }
  return (
    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
      <CircleHelp className="mt-0.5 size-4 shrink-0" />
      {t('proofs.unchecked')}
    </p>
  )
}

// One requested image: an example of what we want, how to take it (read aloud on request), the upload and its check
export default function ProofSlot({ slot, number, image, check, speech, onFile }) {
  const { t, lang } = useI18n()
  const [zoom, setZoom] = useState(null)
  const example = proofExamples()[slot.id]
  const how = t(`proofs.${slot.id}How`)
  const speaking = speech.speakingId === slot.id

  return (
    <div
      className={cn(
        'grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-[88px_1fr]',
        check?.status === 'valid' && 'border-green-600/40',
        check?.status === 'invalid' && 'border-red-600/50'
      )}
    >
      <button type="button" onClick={() => setZoom(example)} className="group flex w-[88px] flex-col items-center gap-1">
        <div className="aspect-[9/16] w-full overflow-hidden rounded-md border bg-muted">
          <img src={example} alt="" className="size-full object-cover object-top transition-transform group-hover:scale-105" />
        </div>
        <span className="text-[11px] text-muted-foreground">{t('proofs.example')}</span>
      </button>

      <div className="grid content-start gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {number}
          </span>
          <p className="font-medium">{t(`proofs.${slot.id}`)}</p>
          <Badge variant="secondary">{t(slot.type === 'photo' ? 'proofs.photo' : 'proofs.screenshot')}</Badge>
          {!slot.required && <Badge variant="outline">{t('proofs.optional')}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{how}</p>
        {slot.id === COVER_PROOF && <p className="text-xs text-muted-foreground">{t('proofs.cover')}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {speech.supported && (
            <Button type="button" variant="ghost" size="sm" onClick={() => speech.toggle(slot.id, how, lang)} aria-pressed={speaking}>
              {speaking ? <Square /> : <Volume2 />}
              {speaking ? t('proofs.stop') : t('proofs.listen')}
            </Button>
          )}
          <Button type="button" variant={image ? 'outline' : 'default'} size="sm" asChild>
            <label className="cursor-pointer">
              <Upload />
              {image ? t('proofs.replace') : t('proofs.upload')}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) onFile(file)
                }}
              />
            </label>
          </Button>
          {image && (
            <button type="button" onClick={() => setZoom(image)} className="size-10 overflow-hidden rounded border">
              <img src={image} alt="" className="size-full object-cover object-top" />
            </button>
          )}
        </div>
        <CheckStatus check={check} />
      </div>

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setZoom(null)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <img src={zoom} alt="" className="max-h-[80vh] max-w-full rounded-lg bg-white object-contain" />
            <Button type="button" variant="secondary" size="icon" className="absolute -end-3 -top-3 rounded-full" onClick={() => setZoom(null)} aria-label={t('proofs.close')}>
              <X />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
