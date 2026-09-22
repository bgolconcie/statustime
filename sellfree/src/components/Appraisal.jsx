import { AlertTriangle, Loader2, ScanSearch, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

function formatMonth(yyyyMm, locale) {
  const [year, month] = yyyyMm.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(new Date(year, month - 1))
}

function factRows(facts, t, locale) {
  const unknown = t('fact.unknown')
  return [
    ['fact.model', [facts.brand, facts.model].filter(Boolean).join(' ') || unknown],
    ['fact.storage', facts.storageGb ? `${facts.storageGb} GB` : unknown],
    ['fact.purchased', facts.purchaseDate ? formatMonth(facts.purchaseDate, locale) : unknown],
    ['fact.battery', facts.batteryHealthPct != null ? `${facts.batteryHealthPct}%` : unknown],
    ['fact.screen', t(`screen.${facts.screenCondition}`)],
    ['fact.body', t(`body.${facts.bodyCondition}`)],
    ['fact.parts', facts.nonGenuineParts.length ? t('fact.nonGenuine', { parts: facts.nonGenuineParts.join(', ') }) : t('fact.allGenuine')],
    ['fact.diagnostics', facts.diagnosticsPassed == null ? unknown : facts.diagnosticsPassed ? t('fact.passed') : t('fact.failed')],
    ['fact.network', facts.networkLocked == null ? unknown : facts.networkLocked ? t('fact.locked') : t('fact.unlocked')],
  ]
}

export function FactList({ facts }) {
  const { t, lang } = useI18n()
  const locale = lang === 'he' ? 'he-IL' : 'en-US'
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      {factRows(facts, t, locale).map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-muted-foreground">{t(key)}</dt>
          <dd className="font-medium">
            <bdi>{value}</bdi>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Issues({ issues }) {
  const { t } = useI18n()
  if (!issues?.length) return null
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="mb-1 flex items-center gap-1.5 font-medium">
        <AlertTriangle className="size-4" />
        {t('appraisal.issues')}
      </p>
      <ul className="list-disc space-y-0.5 ps-5">
        {issues.map((issue, i) => (
          <li key={i}>
            <bdi>{issue}</bdi>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Estimate({ valuation, action }) {
  const { t, formatPrice } = useI18n()
  if (!valuation) return <p className="text-sm text-muted-foreground">{t('appraisal.noEstimate')}</p>
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs text-muted-foreground">{t('appraisal.estimate')}</p>
        <p className="text-2xl font-bold">{formatPrice(valuation.value, 'ILS')}</p>
        <p className="text-xs text-muted-foreground">
          {formatPrice(valuation.low, 'ILS')} – {formatPrice(valuation.high, 'ILS')} · {t('appraisal.basedOn', { price: formatPrice(valuation.base, 'ILS') })}
        </p>
      </div>
      {action}
    </div>
  )
}

function Factors({ valuation }) {
  const { t } = useI18n()
  if (!valuation?.factors.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {valuation.factors.map((f) => (
        <Badge key={f.key} variant="outline" className="font-normal">
          {t(`factor.${f.key}`, { years: valuation.ageYears })} −{Math.round((1 - f.factor) * 100)}%
        </Badge>
      ))}
    </div>
  )
}

// Shown to the seller while filling in a phone listing
export function AppraisalPanel({ state, onRetry, onUsePrice }) {
  const { t, errorText, formatPrice } = useI18n()

  return (
    <div className="grid gap-4 rounded-lg border p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <ScanSearch className="size-4" />
        {t('appraisal.title')}
      </p>

      {state.status === 'loading' && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('appraisal.loading')}
        </p>
      )}

      {state.status === 'error' && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {state.error?.code === 'ai_unavailable' || state.error?.code === 'appraisal_limit' ? errorText(state.error) : t('appraisal.failed')}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t('appraisal.retry')}
          </Button>
        </div>
      )}

      {state.status === 'done' && (
        <>
          <Estimate
            valuation={state.appraisal.valuation}
            action={
              state.appraisal.valuation && (
                <Button type="button" size="sm" onClick={() => onUsePrice(state.appraisal.valuation.value)}>
                  {t('appraisal.usePrice', { price: formatPrice(state.appraisal.valuation.value, 'ILS') })}
                </Button>
              )
            }
          />
          <Factors valuation={state.appraisal.valuation} />
          <FactList facts={state.appraisal.facts} />
          <Issues issues={state.appraisal.facts.issues} />
          <p className="text-xs text-muted-foreground">{t(`appraisal.confidence.${state.appraisal.facts.confidence}`)}</p>
        </>
      )}
    </div>
  )
}

function priceVerdict(price, currency, valuation) {
  if (!valuation || currency !== 'ILS') return null
  if (price < valuation.low) return { key: 'appraisal.priceBelow', tone: 'text-green-700 border-green-600/30' }
  if (price > valuation.high) return { key: 'appraisal.priceAbove', tone: 'text-amber-700 border-amber-600/30' }
  return { key: 'appraisal.priceWithin', tone: '' }
}

// Shown to buyers on the listing page
export function AppraisalSummary({ listing }) {
  const { t } = useI18n()
  const { facts, valuation } = listing.appraisal
  const verdict = priceVerdict(listing.price, listing.currency, valuation)

  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <ShieldCheck className="size-4" />
          {t('appraisal.verified')}
        </p>
        {verdict && (
          <Badge variant="outline" className={cn(verdict.tone)}>
            {t(verdict.key)}
          </Badge>
        )}
      </div>
      <Estimate valuation={valuation} />
      <FactList facts={facts} />
      <Issues issues={facts.issues} />
    </div>
  )
}
