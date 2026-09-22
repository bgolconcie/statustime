import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AGE_GROUPS, BRANDS, CATEGORIES, CONDITIONS, PHONE_PROOFS } from '@/lib/catalog'
import { fileToThumbnail } from '@/lib/image'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import CategoryIcon from '@/components/CategoryIcon'
import ProofUpload from '@/components/ProofUpload'
import { AppraisalPanel } from '@/components/Appraisal'
import { useI18n } from '@/i18n'

function suggestCondition(facts) {
  if (facts.diagnosticsPassed === false) return 'forParts'
  const worst = [facts.screenCondition, facts.bodyCondition]
  if (worst.some((c) => c === 'cracked' || c === 'damaged')) return 'fair'
  if (worst.some((c) => c === 'deepScratches' || c === 'heavyWear')) return 'good'
  if (worst.every((c) => c === 'flawless')) return 'likeNew'
  if (worst.includes('unknown')) return null
  return 'good'
}

const EMPTY = { title: '', brand: '', model: '', description: '', category: CATEGORIES[0], condition: CONDITIONS[1], price: '', ageGroups: [], image: null, proofs: {} }

export default function Sell() {
  const { t, lang, ageRange, errorText, currency, currencySymbol } = useI18n()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [myCount, setMyCount] = useState(0)
  const [appraisal, setAppraisal] = useState({ status: 'idle' })
  const appraisalRun = useRef(0)

  useEffect(() => {
    api('/listings?mine=1')
      .then((d) => setMyCount(d.listings.length))
      .catch(() => {})
  }, [])

  const isPhone = form.category === 'phones'
  const proofsComplete = isPhone && PHONE_PROOFS.every((k) => form.proofs[k])

  // Fill in what the screenshots told us, without overwriting what the seller typed
  const applyAppraisal = useCallback(
    ({ facts, valuation }) =>
      setForm((f) => ({
        ...f,
        brand: f.brand || facts.brand || '',
        model: f.model || facts.model || '',
        title: f.title || [facts.brand, facts.model, facts.storageGb && `${facts.storageGb}GB`].filter(Boolean).join(' '),
        condition: suggestCondition(facts) ?? f.condition,
        price: f.price === '' && valuation && currency === 'ILS' ? String(valuation.value) : f.price,
      })),
    [currency]
  )

  // Read the screenshots once all 5 are in; a newer run supersedes older ones.
  // Brand and model are only hints, so typing them doesn't trigger a new read.
  const hints = useRef({})
  hints.current = { brand: form.brand, model: form.model }
  const runAppraisal = useCallback(async () => {
    const run = ++appraisalRun.current
    setAppraisal({ status: 'loading' })
    try {
      const { appraisal: result } = await api('/appraisals', {
        method: 'POST',
        body: { proofs: form.proofs, ...hints.current, lang },
      })
      if (run !== appraisalRun.current) return
      setAppraisal({ status: 'done', appraisal: result })
      applyAppraisal(result)
    } catch (err) {
      if (run === appraisalRun.current) setAppraisal({ status: 'error', error: err })
    }
  }, [form.proofs, lang, applyAppraisal])

  useEffect(() => {
    if (proofsComplete) {
      runAppraisal()
    } else {
      appraisalRun.current++
      setAppraisal({ status: 'idle' })
    }
  }, [proofsComplete, runAppraisal])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const toggleAge = (id) =>
    setForm((f) => ({
      ...f,
      ageGroups: f.ageGroups.includes(id) ? f.ageGroups.filter((g) => g !== id) : [...f.ageGroups, id],
    }))

  const onImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const image = await fileToThumbnail(file)
    setForm((f) => ({ ...f, image }))
  }

  const submit = (addAnother) => async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return setError(t('sell.errorTitle'))
    if (!form.brand.trim()) return setError(t('sell.errorBrand'))
    if (!form.ageGroups.length) return setError(t('sell.errorAges'))
    if (isPhone && !proofsComplete) return setError(t('proofs.missing'))
    setSaving(true)
    try {
      await api('/listings', {
        method: 'POST',
        body: {
          ...form,
          title: form.title.trim(),
          price: Math.max(0, Number(form.price) || 0),
          currency,
          proofs: isPhone ? form.proofs : {},
          appraisalId: isPhone && appraisal.status === 'done' ? appraisal.appraisal.id : null,
        },
      })
      setError('')
      if (!addAnother) return navigate('/my-listings')
      setForm(EMPTY)
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
            <CardDescription>
              {t('sell.subtitle', { count: myCount })}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <label
              className={cn(
                'flex aspect-[16/9] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-muted/50',
                form.image && 'border-solid'
              )}
            >
              {form.image ? (
                <img src={form.image} alt="" className="size-full object-cover" />
              ) : (
                <>
                  <ImagePlus className="size-6" />
                  {t('sell.photo')}
                </>
              )}
              <input type="file" accept="image/*" className="sr-only" onChange={onImage} />
            </label>

            <div className="grid gap-2">
              <Label>{t('sell.category')}</Label>
              <div className="grid grid-cols-3 gap-2">
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

            {form.category === 'phones' && (
              <div className="grid gap-3 rounded-lg bg-muted/40 p-4">
                <div className="space-y-1">
                  <Label>{t('proofs.title')}</Label>
                  <p className="text-xs text-muted-foreground">{t('proofs.subtitle')}</p>
                </div>
                {PHONE_PROOFS.map((kind) => (
                  <ProofUpload
                    key={kind}
                    kind={kind}
                    image={form.proofs[kind]}
                    onChange={(image) => {
                      setForm((f) => ({ ...f, proofs: { ...f.proofs, [kind]: image } }))
                      setError('')
                    }}
                  />
                ))}
                {appraisal.status !== 'idle' && (
                  <AppraisalPanel
                    state={appraisal}
                    onRetry={runAppraisal}
                    // The estimate is in shekels; only offer it when the seller prices in shekels
                    onUsePrice={currency === 'ILS' ? (value) => setForm((f) => ({ ...f, price: String(value) })) : null}
                  />
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label>{t('sell.ages')}</Label>
              <div className="flex flex-wrap gap-2">
                {AGE_GROUPS.map((g) => {
                  const active = form.ageGroups.includes(g.id)
                  return (
                    <Button key={g.id} type="button" size="sm" variant={active ? 'default' : 'outline'} onClick={() => toggleAge(g.id)}>
                      {active && <Check />}
                      {t(`ageGroup.${g.id}`)} <span className="opacity-70">{ageRange(g.id)}</span>
                    </Button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">{t('sell.agesHint')}</p>
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
