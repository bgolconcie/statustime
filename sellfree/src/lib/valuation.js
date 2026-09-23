// Turns facts read from a phone's screenshots into an estimated resale value (ILS).
// Every factor here is a starting point; calibrate against real sales over time.

// Physical condition as the AI saw it in the device photo
const SCREEN = { flawless: 1, lightScratches: 0.95, deepScratches: 0.85, cracked: 0.6 }
const BODY = { flawless: 1, lightWear: 0.97, heavyWear: 0.9, damaged: 0.8 }
// Fallback when the photo didn't show it: the seller's declared condition
const CONDITION = { new: 1, likeNew: 0.97, good: 0.9, fair: 0.75, forParts: 0.3 }

const FIRST_YEAR_LOSS = 0.3
const YEARLY_LOSS_AFTER = 0.15
const FLOOR = 0.15

// "YYYY-MM" or a release year → age in years
function ageInYears({ purchaseDate, releaseYear }, now) {
  const match = /^(\d{4})-(\d{2})$/.exec(purchaseDate ?? '')
  const start = match ? new Date(Number(match[1]), Number(match[2]) - 1) : releaseYear ? new Date(releaseYear, 8) : null
  if (!start) return null
  return Math.max(0, (now - start) / (365.25 * 24 * 3600 * 1000))
}

function ageFactor(age) {
  if (age == null) return 0.7
  const factor = age <= 1 ? 1 - FIRST_YEAR_LOSS * age : (1 - FIRST_YEAR_LOSS) * (1 - YEARLY_LOSS_AFTER) ** (age - 1)
  return Math.max(FLOOR, factor)
}

function batteryFactor(pct) {
  if (pct == null) return 0.95
  if (pct >= 90) return 1
  if (pct >= 85) return 0.97
  if (pct >= 80) return 0.93
  return 0.85
}

const roundTo10 = (n) => Math.round(n / 10) * 10

export function estimatePhoneValue(facts, { condition, now = Date.now() } = {}) {
  if (!facts?.launchPriceIls) return null

  const age = ageInYears(facts, now)
  const seen = facts.screenCondition in SCREEN || facts.bodyCondition in BODY
  const physical = seen
    ? [
        { key: 'screen', factor: SCREEN[facts.screenCondition] ?? 1 },
        { key: 'body', factor: BODY[facts.bodyCondition] ?? 1 },
        // A device the seller says is for parts is priced that way whatever the photo shows
        { key: 'condition', factor: condition === 'forParts' ? CONDITION.forParts : 1 },
      ]
    : [{ key: 'condition', factor: CONDITION[condition] ?? CONDITION.good }]
  const factors = [
    { key: 'age', factor: ageFactor(age) },
    ...physical,
    { key: 'battery', factor: batteryFactor(facts.batteryHealthPct) },
    { key: 'parts', factor: facts.nonGenuineParts?.length ? 0.9 : 1 },
    // Already priced in when the seller declares it "for parts"
    { key: 'diagnostics', factor: facts.diagnosticsPassed === false && condition !== 'forParts' ? 0.5 : 1 },
    { key: 'network', factor: facts.networkLocked ? 0.9 : 1 },
  ]
  const value = factors.reduce((v, f) => v * f.factor, facts.launchPriceIls)

  return {
    value: roundTo10(value),
    low: roundTo10(value * 0.9),
    high: roundTo10(value * 1.1),
    base: facts.launchPriceIls,
    ageYears: age == null ? null : Math.round(age * 10) / 10,
    // Only the factors that actually moved the price
    factors: factors.filter((f) => f.factor !== 1).map((f) => ({ ...f, factor: Math.round(f.factor * 100) / 100 })),
  }
}
