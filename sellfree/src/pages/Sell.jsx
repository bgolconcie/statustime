import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { BRANDS, CATEGORIES, CONDITIONS, PROOF_IDS, PROOF_SLOTS, REQUIRED_PROOFS } from '@/lib/catalog'
import { MIN_READABLE_SIZE, readUpload } from '@/lib/image'
import { estimatePhoneValue } from '@/lib/valuation'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useSpeech } from '@/hooks/useSpeech'
import CategoryIcon from '@/components/CategoryIcon'
import ProofSlot from '@/components/ProofSlot'
import { AppraisalPanel } from '@/components/Appraisal'
import { useI18n } from '@/i18n'

// Condition suggested from what the AI saw in the photos and screenshots
function suggestCondition(facts) {
  if (facts.diagnosticsPassed === false) return 'forParts'
  const parts = [facts.screenCondition, facts.bodyCondition]
  if (parts.some((c) => c === 'cracked' || c === 'damaged')) return 'fair'
  if (parts.some((c) => c === 'deepScratches' || c === 'heavyWear')) return 'good'
  if (parts.includes('unknown')) return null
  if (parts.every((c) => c === 'flawless')) return 'likeNew'
  return 'good'
}

const EMPTY = {
  title: '', brand: '', model: '', description: '', category: CATEGORIES[0], condition: CONDITIONS[1], price: '',
  proofs: {},
}

export default function Sell() {
  const { t, lang, errorText, currency, currencySymbol } = useI18n()
  const navigate = useNavigate()
  const speech = useSpeech()
  const [form, setForm] = useState(EMPTY)
  // Per image: { status: 'checking' | 'valid' | 'invalid' | 'unchecked', reason }
  const [checks, setChecks] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [myCount, setMyCount] = useState(0)
  const [appraisal, setAppraisal] = useState({ status: 'idle' })
  const appraisalRun = useRef(0)
  const checkRuns = useRef({})

  useEffect(() => {
    api('/listings?mine=1')
      .then((d) => setMyCount(d.listings.length))
      .catch(() => {})
  }, [])

  const filled = PROOF_SLOTS.filter((s) => form.proofs[s.id]).map((s) => s.id)
  const missing = REQUIRED_PROOFS.filter((id) => !form.proofs[id])
  // A failed optional image (the box) is just left out; a failed required one has to be retaken
  const anyInvalid = REQUIRED_PROOFS.some((id) => checks[id]?.status === 'invalid')
  const anyChecking = filled.some((id) => checks[id]?.status === 'checking')
  // The full AI check runs once every required image is in and none still needs attention
  const readyForCheck = missing.length === 0 && !anyInvalid && !anyChecking
  // Only images that passed (or couldn't be checked) go to the full check and the listing
  const acceptedProofs = Object.fromEntries(filled.filter((id) => checks[id]?.status !== 'invalid').map((id) => [id, form.proofs[id]]))

  // Check a single image the moment it's added
  const addImage = async (slot, file) => {
    setError('')
    const run = (checkRuns.current[slot.id] = (checkRuns.current[slot.id] ?? 0) + 1)
    const { dataUrl, width, height } = await readUpload(file)
    setForm((f) => ({ ...f, proofs: { ...f.proofs, [slot.id]: dataUrl } }))
    if (Math.min(width, height) < MIN_READABLE_SIZE) {
      return setChecks((c) => ({ ...c, [slot.id]: { status: 'invalid', reason: t('proofs.tooSmall') } }))
    }
    setChecks((c) => ({ ...c, [slot.id]: { status: 'checking' } }))
    let result
    try {
      const { valid, reason } = await api('/appraisals/check-image', { method: 'POST', body: { kind: slot.id, image: dataUrl, lang } })
      result = valid ? { status: 'valid' } : { status: 'invalid', reason }
    } catch {
      // If the check itself isn't available, don't block the seller; the full check still reads it
      result = { status: 'unchecked' }
    }
    if (checkRuns.current[slot.id] === run) setChecks((c) => ({ ...c, [slot.id]: result }))
  }

  // Fill in what the AI found, without overwriting what the seller typed
  const applyAppraisal = useCallback(
    ({ facts }) =>
      setForm((f) => {
        const condition = suggestCondition(facts) ?? f.condition
        const valuation = estimatePhoneValue(facts, { condition })
        return {
          ...f,
          brand: f.brand || facts.brand || '',
          model: f.model || facts.model || '',
          title: f.title || [facts.brand, facts.model, facts.storageGb && `${facts.storageGb}GB`].filter(Boolean).join(' '),
          condition,
          price: f.price === '' && valuation && currency === 'ILS' ? String(valuation.value) : f.price,
        }
      }),
    [currency]
  )

  // A newer run supersedes older ones. Brand and model are only hints, so typing them doesn't re-run it.
  const hints = useRef({})
  hints.current = { brand: form.brand, model: form.model, condition: form.condition }
  // Changes whenever an image is replaced or its check finishes, so the full check re-runs on new images
  const proofsKey = PROOF_IDS.map((id) => `${checkRuns.current[id] ?? 0}:${checks[id]?.status ?? ''}`).join()
  const latestProofs = useRef(acceptedProofs)
  latestProofs.current = acceptedProofs
  const runAppraisal = useCallback(async () => {
    const run = ++appraisalRun.current
    setAppraisal({ status: 'loading' })
    try {
      const { appraisal: result } = await api('/appraisals', {
        method: 'POST',
        body: { proofs: latestProofs.current, ...hints.current, lang },
      })
      if (run !== appraisalRun.current) return
      setAppraisal({ status: 'done', appraisal: result })
      applyAppraisal(result)
    } catch (err) {
      if (run === appraisalRun.current) setAppraisal({ status: 'error', error: err })
    }
  }, [lang, applyAppraisal])

  useEffect(() => {
    if (readyForCheck) {
      runAppraisal()
    } else {
      appraisalRun.current++
      setAppraisal({ status: 'idle' })
    }
  }, [readyForCheck, proofsKey, runAppraisal])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))


  const submit = (addAnother) => async (e) => {
    e.preventDefault()
    if (missing.length) return setError(t('proofs.missing'))
    if (anyInvalid) return setError(t('proofs.invalid'))
    if (anyChecking) return setError(t('proofs.pending'))
    if (!form.title.trim()) return setError(t('sell.errorTitle'))
    if (!form.brand.trim()) return setError(t('sell.errorBrand'))
    setSaving(true)
    try {
      const { proofs: _images, ...fields } = form
      await api('/listings', {
        method: 'POST',
        body: {
          ...fields,
          title: form.title.trim(),
          price: Math.max(0, Number(form.price) || 0),
          currency,
          proofs: acceptedProofs,
          appraisalId: appraisal.status === 'done' ? appraisal.appraisal.id : null,
        },
      })
      setError('')
      if (!addAnother) return navigate('/my-listings')
      setForm(EMPTY)
      setChecks({})
      setMyCount((n) => n + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <form onSubmit={submit(false)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t('sell.title')}</CardTitle>
            <CardDescription>{t('sell.subtitle', { count: myCount })}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label>{t('sell.category')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category: c }))}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-muted/50',
                      form.category === c && 'border-primary bg-muted ring-1 ring-primary'
                    )}
                  >
                    <CategoryIcon category={c} className="size-5" />
                    {t(`category.${c}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 rounded-lg bg-muted/40 p-4">
              <div className="space-y-1">
                <Label>{t('proofs.title')}</Label>
                <p className="text-xs text-muted-foreground">{t('proofs.subtitle')}</p>
              </div>
              {PROOF_SLOTS.map((slot, i) => (
                <ProofSlot
                  key={slot.id}
                  slot={slot}
                  number={i + 1}
                  image={form.proofs[slot.id]}
                  check={checks[slot.id]}
                  speech={speech}
                  onFile={(file) => addImage(slot, file)}
                />
              ))}
              {appraisal.status !== 'idle' && (
                <AppraisalPanel
                  // Re-price live as the seller changes the declared condition
                  state={
                    appraisal.status === 'done'
                      ? { ...appraisal, appraisal: { ...appraisal.appraisal, valuation: estimatePhoneValue(appraisal.appraisal.facts, { condition: form.condition }) } }
                      : appraisal
                  }
                  onRetry={runAppraisal}
                  // The estimate is in shekels; only offer it when the seller prices in shekels
                  onUsePrice={currency === 'ILS' ? (value) => setForm((f) => ({ ...f, price: String(value) })) : null}
                />
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title">{t('sell.titleLabel')}</Label>
              <Input id="title" dir="auto" placeholder={t('sell.titlePlaceholder')} value={form.title} onChange={set('title')} />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="brand">{t('sell.brand')}</Label>
                <Input id="brand" list="brand-options" dir="auto" placeholder={t('sell.brandPlaceholder')} value={form.brand} onChange={set('brand')} />
                <datalist id="brand-options">
                  {BRANDS[form.category].map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="model">{t('sell.model')}</Label>
                <Input id="model" dir="auto" placeholder={t('sell.modelPlaceholder')} value={form.model} onChange={set('model')} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">{t('sell.description')}</Label>
              <Textarea id="description" dir="auto" placeholder={t('sell.descriptionPlaceholder')} value={form.description} onChange={set('description')} />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="condition">{t('sell.condition')}</Label>
                <NativeSelect id="condition" value={form.condition} onChange={set('condition')}>
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {t(`condition.${c}`)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price">{t('sell.price', { currency: currencySymbol })}</Label>
                <Input id="price" type="number" min={0} placeholder={t('sell.pricePlaceholder')} value={form.price} onChange={set('price')} />
              </div>
            </div>


            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={submit(true)}>
              {t('sell.publishAnother')}
            </Button>
            <Button type="submit" disabled={saving}>
              {t('sell.publish')}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </main>
  )
}
