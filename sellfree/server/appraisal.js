import Anthropic from '@anthropic-ai/sdk'
import { PHONE_PROOFS } from '../src/lib/catalog.js'

const MODEL = 'claude-opus-5'

const PROOF_LABELS = {
  modelStorage: 'Screenshot of the phone "About" page (model name, capacity, possibly SIM/carrier lock status)',
  purchaseDate: 'Screenshot or photo showing the purchase date or warranty status',
  condition: 'Photo of the phone itself (screen on, front and back) for physical condition',
  battery: 'Screenshot of the battery health page',
  diagnostics: 'Screenshot of parts & service history or a diagnostics test result',
}

const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] })

const FACTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'brand', 'model', 'storageGb', 'purchaseDate', 'releaseYear', 'batteryHealthPct', 'screenCondition',
    'bodyCondition', 'nonGenuineParts', 'diagnosticsPassed', 'networkLocked', 'launchPriceIls', 'confidence', 'issues',
  ],
  properties: {
    brand: nullable({ type: 'string' }),
    model: nullable({ type: 'string' }),
    storageGb: nullable({ type: 'integer' }),
    purchaseDate: nullable({ type: 'string', description: 'YYYY-MM' }),
    releaseYear: nullable({ type: 'integer' }),
    batteryHealthPct: nullable({ type: 'integer' }),
    screenCondition: { type: 'string', enum: ['flawless', 'lightScratches', 'deepScratches', 'cracked', 'unknown'] },
    bodyCondition: { type: 'string', enum: ['flawless', 'lightWear', 'heavyWear', 'damaged', 'unknown'] },
    nonGenuineParts: { type: 'array', items: { type: 'string' } },
    diagnosticsPassed: nullable({ type: 'boolean' }),
    networkLocked: nullable({ type: 'boolean' }),
    launchPriceIls: nullable({ type: 'integer' }),
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    issues: { type: 'array', items: { type: 'string' } },
  },
}

const SYSTEM = `You read screenshots and photos that a seller uploaded for a used phone listing on an Israeli marketplace, and extract the facts needed to price it.

Rules:
- Only report what the images show. Use null (or "unknown") when an image doesn't show a field; never guess model, storage, battery or dates.
- Screenshots may be in Hebrew or English, from iOS or Android.
- purchaseDate is year and month (YYYY-MM) when a purchase or warranty-start date is visible.
- releaseYear and launchPriceIls come from your own knowledge of the identified model and storage: the year the model launched and its typical launch retail price in Israel in shekels, new. Leave them null if the model isn't clearly identified.
- nonGenuineParts lists parts marked as unknown/non-genuine in parts history (e.g. "display", "battery"); empty if all genuine or not shown.
- issues: short notes about anything a buyer should know — images that don't match each other, a screenshot that looks edited or unrelated, an image that shows a different phone than the others, or missing information.
- confidence reflects how clearly the images support the facts.`

let client
function getClient() {
  client ??= new Anthropic()
  return client
}

export class AppraisalUnavailableError extends Error {}

function imageBlock(dataUrl) {
  const [, mediaType, data] = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl)
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data } }
}

// proofs: { [kind]: dataUrl } for every PHONE_PROOFS kind
export async function extractPhoneFacts(proofs, { sellerBrand, sellerModel, lang = 'en' } = {}) {
  const content = PHONE_PROOFS.flatMap((kind, i) => [
    { type: 'text', text: `Image ${i + 1}: ${PROOF_LABELS[kind]}` },
    imageBlock(proofs[kind]),
  ])
  if (sellerBrand || sellerModel) {
    content.push({ type: 'text', text: `The seller says this is: ${[sellerBrand, sellerModel].filter(Boolean).join(' ')}. Note in issues if the images disagree.` })
  }
  content.push({ type: 'text', text: `Extract the facts. Write the issues in ${lang === 'he' ? 'Hebrew' : 'English'}.` })

  let response
  try {
    response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: FACTS_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw new AppraisalUnavailableError('Claude API credentials are missing or invalid')
    }
    throw err
  }

  if (response.stop_reason === 'refusal') throw new AppraisalUnavailableError('The request was declined')
  if (response.stop_reason === 'max_tokens') throw new Error('Appraisal output was cut off')
  const text = response.content.find((b) => b.type === 'text')?.text
  return JSON.parse(text)
}
