import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

export default function ProofGallery({ proofs }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {proofs.map((p) => (
          <button key={p.kind} type="button" onClick={() => setOpen(p)} className="group flex flex-col gap-1 text-start">
            <div className="aspect-[9/16] overflow-hidden rounded-md border bg-muted">
              <img src={p.image} alt={t(`proofs.${p.kind}`)} className="size-full object-cover object-top transition-transform group-hover:scale-[1.03]" />
            </div>
            <span className="text-xs text-muted-foreground">{t(`proofs.${p.kind}`)}</span>
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(null)}>
          <div className="relative flex max-h-full flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <img src={open.image} alt={t(`proofs.${open.kind}`)} className="max-h-[80vh] max-w-full rounded-lg bg-white object-contain" />
            <p className="text-sm font-medium text-white">{t(`proofs.${open.kind}`)}</p>
            <Button variant="secondary" size="icon" className="absolute -top-3 -end-3 rounded-full" onClick={() => setOpen(null)} aria-label={t('proofs.close')}>
              <X />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
