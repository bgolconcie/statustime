import { CheckCircle2, Upload } from 'lucide-react'
import { fileToThumbnail } from '@/lib/image'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

// Screenshots stay readable at this size
const PROOF_MAX_SIZE = 1280

export default function ProofUpload({ kind, image, onChange }) {
  const { t } = useI18n()

  const pick = async (e) => {
    const file = e.target.files?.[0]
    if (file) onChange(await fileToThumbnail(file, PROOF_MAX_SIZE))
  }

  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50',
        image ? 'border-primary/40' : 'border-dashed'
      )}
    >
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {image ? <img src={image} alt="" className="size-full object-cover object-top" /> : <Upload className="size-5 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          {image && <CheckCircle2 className="size-4 shrink-0 text-green-600" />}
          {t(`proofs.${kind}`)}
        </p>
        <p className="text-xs text-muted-foreground">{t(`proofs.${kind}Hint`)}</p>
      </div>
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{t('proofs.upload')}</span>
      <input type="file" accept="image/*" className="sr-only" onChange={pick} />
    </label>
  )
}
