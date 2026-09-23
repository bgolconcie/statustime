import Anthropic from '@anthropic-ai/sdk'
import { PHONE_PROOFS } from '../src/lib/catalog.js'

const MODEL = 'claude-opus-5'

const PROOF_LABELS = {
  modelStorage: 'Screenshot of the device "About" page (model name, capacity, possibly SIM/carrier lock status)',
  purchaseDate: 'Screenshot or photo showing the purchase date or warranty status',
  network: 'Screenshot showing the carrier/SIM lock status (and possibly the IMEI); for Wi-Fi-only tablets, the About page',
  battery: 'Screenshot of the battery health page',
  diagnostics: 'Screenshot of parts & service history or a diagnostics test result',
}

const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] })

const FACTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'brand', 'model', 'storageGb', 'purchaseDate', 'releaseYear', 'batteryHealthPct', 'screenCondition', 'bodyCondition',
    'nonGenuineParts', 'diagnosticsPassed', 'networkLocked', 'launchPriceIls', 'problems', 'confidence', 'issues',
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
    problems: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    issues: { type: 'array', items: { type: 'string' } },
  },
}

const SYSTEM = `You inspect a used phone or tablet (e.g. iPad) for an Israeli marketplace listing. The seller uploaded a photo of the device and 5 screenshots of its own settings screens. Identify the device and extract the facts needed to price it.

Rules:
- screenCondition and bodyCondition come from the device photo only: look for scratches, cracks, dents, chips and wear. Use "unknown" when the photo doesn't show that part clearly.
- problems: short notes on every defect or risk you find — cracked or scratched screen, dents, battery below 80% or a service warning, non-genuine or replaced parts, failed diagnostics, carrier lock. Empty when there are none.
- Only report what the images show. Use null (or "unknown") when an image doesn't show a field; never guess model, storage, battery or dates.
- Screenshots may be in Hebrew or English, from iOS or Android.
- purchaseDate is year and month (YYYY-MM) when a purchase or warranty-start date is visible.
- networkLocked is false for Wi-Fi-only tablets.
- releaseYear and launchPriceIls come from your own knowledge of the identified model and storage: the year the model launched and its typical launch retail price in Israel in shekels, new. Leave them null if the model isn't clearly identified.
- nonGenuineParts lists parts marked as unknown/non-genuine in parts history (e.g. "display", "battery"); empty if all genuine or not shown.
- Never copy an IMEI or serial number into your answer.
- issues: short notes about the listing itself — images that don't match each other, a screenshot that looks edited or unrelated, an image that shows a different device than the others, or missing information.
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
export async function extractPhoneFacts(proofs, { photo, sellerBrand, sellerModel, lang = 'en' } = {}) {
  const content = [
    { type: 'text', text: 'Image 1: Photo of the device itself, for its physical condition' },
    imageBlock(photo),
    ...PHONE_PROOFS.flatMap((kind, i) => [
      { type: 'text', text: `Image ${i + 2}: ${PROOF_LABELS[kind]}` },
      imageBlock(proofs[kind]),
    ]),
  ]
  if (sellerBrand || sellerModel) {
    content.push({ type: 'text', text: `The seller says this is: ${[sellerBrand, sellerModel].filter(Boolean).join(' ')}. Note in issues if the images disagree.` })
  }
  content.push({ type: 'text', text: `Extract the facts. Write the problems and issues in ${lang === 'he' ? 'Hebrew' : 'English'}.` })

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
