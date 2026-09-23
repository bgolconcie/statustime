import Anthropic from '@anthropic-ai/sdk'
import { PROOF_IDS } from '../src/lib/catalog.js'

const MODEL = 'claude-opus-5'

// What each slot should contain, for Claude
const PROOF_LABELS = {
  deviceInfo: 'Screenshot of the device "About" settings page showing model name, model number and storage capacity (Android: About phone, which may also show RAM)',
  partsLock: 'Screenshot of the About page scrolled down: carrier/SIM lock status and parts & service history (genuine or replaced parts)',
  battery: 'Screenshot of the battery health page: maximum capacity % (and possibly cycle count)',
  purchaseDate: 'Screenshot of the warranty/coverage page with the purchase date, or a photo of the purchase receipt',
  screenOn: 'Photo of the device front with the screen on, showing a plain white image (for cracks, spots, dead pixels, burn-in)',
  screenOff: 'Photo of the device front with the screen off, lit at an angle (for scratches)',
  back: 'Photo of the back of the device',
  box: 'Photo of the original box and/or charging cable (optional)',
}

const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] })

const FACTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'brand', 'model', 'modelNumber', 'ramGb', 'storageGb', 'purchaseDate', 'releaseYear', 'batteryHealthPct', 'batteryCycles',
    'screenCondition', 'bodyCondition', 'nonGenuineParts', 'diagnosticsPassed', 'networkLocked', 'includesBox', 'includesCable',
    'launchPriceIls', 'problems', 'confidence', 'issues',
  ],
  properties: {
    brand: nullable({ type: 'string' }),
    model: nullable({ type: 'string' }),
    modelNumber: nullable({ type: 'string' }),
    ramGb: nullable({ type: 'integer' }),
    storageGb: nullable({ type: 'integer' }),
    purchaseDate: nullable({ type: 'string', description: 'YYYY-MM' }),
    releaseYear: nullable({ type: 'integer' }),
    batteryHealthPct: nullable({ type: 'integer' }),
    batteryCycles: nullable({ type: 'integer' }),
    screenCondition: { type: 'string', enum: ['flawless', 'lightScratches', 'deepScratches', 'cracked', 'unknown'] },
    bodyCondition: { type: 'string', enum: ['flawless', 'lightWear', 'heavyWear', 'damaged', 'unknown'] },
    nonGenuineParts: { type: 'array', items: { type: 'string' } },
    diagnosticsPassed: nullable({ type: 'boolean' }),
    networkLocked: nullable({ type: 'boolean' }),
    includesBox: { type: 'boolean' },
    includesCable: { type: 'boolean' },
    launchPriceIls: nullable({ type: 'integer' }),
    problems: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    issues: { type: 'array', items: { type: 'string' } },
  },
}

const SYSTEM = `You inspect a used phone or tablet (e.g. iPad) for an Israeli marketplace listing. The seller uploaded screenshots of the device's own settings screens and photos of the device. Identify the device and extract the facts needed to price it.

Rules:
- modelNumber is the exact model number shown (e.g. A2633, SM-S911B). ramGb comes from the About screen when shown; for iPhone/iPad, which don't show RAM, use the known RAM of the identified model number, or null if unsure.
- includesBox / includesCable: true only if the optional box photo clearly shows the original box / a charging cable.
- screenCondition and bodyCondition come from the device photos only: look for scratches, cracks, dents, chips and wear. Use "unknown" when the photo doesn't show that part clearly.
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

// proofs: { [kind]: dataUrl } for every required slot, plus the optional ones the seller filled
export async function extractPhoneFacts(proofs, { sellerBrand, sellerModel, lang = 'en' } = {}) {
  const content = PROOF_IDS.filter((kind) => proofs[kind]).flatMap((kind, i) => [
    { type: 'text', text: `Image ${i + 1}: ${PROOF_LABELS[kind]}` },
    imageBlock(proofs[kind]),
  ])
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

const CHECK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['valid', 'reason'],
  properties: { valid: { type: 'boolean' }, reason: { type: 'string' } },
}

// Quick check of a single upload: is it the image this slot asks for, and is it clear enough to read?
export async function checkProofImage(kind, image, { lang = 'en' } = {}) {
  let response
  try {
    response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low', format: { type: 'json_schema', schema: CHECK_SCHEMA } },
      system:
        'You check one image a seller uploaded for a used phone or tablet listing. Decide whether it is the image requested ' +
        'and whether the information it should show is clearly visible and readable. valid is true only if both hold. ' +
        `reason: when not valid, one short sentence in ${lang === 'he' ? 'Hebrew' : 'English'} telling the seller what to retake and how; ` +
        'when valid, an empty string. Never copy an IMEI or serial number.',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: `Requested: ${PROOF_LABELS[kind]}` }, imageBlock(image)],
        },
      ],
    })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw new AppraisalUnavailableError('Claude API credentials are missing or invalid')
    }
    throw err
  }
  if (response.stop_reason === 'refusal') throw new AppraisalUnavailableError('The request was declined')
  return JSON.parse(response.content.find((b) => b.type === 'text')?.text)
}
