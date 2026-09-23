import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'
import { hasAllProofs, isUpload, proofsHash } from '../images.js'
import { PROOF_IDS } from '../../src/lib/catalog.js'
import { AppraisalUnavailableError, checkProofImage, extractPhoneFacts } from '../appraisal.js'
import { estimatePhoneValue } from '../../src/lib/valuation.js'

const router = Router()
const DAILY_LIMIT = 20
const DAILY_IMAGE_CHECKS = 200

// Per-seller image checks today (in memory; resets with the server)
const imageChecks = new Map()
function underImageLimit(userId) {
  const today = new Date().toDateString()
  const entry = imageChecks.get(userId)
  const count = entry?.day === today ? entry.count : 0
  if (count >= DAILY_IMAGE_CHECKS) return false
  imageChecks.set(userId, { day: today, count: count + 1 })
  return true
}

// Checks one uploaded image the moment it's added: right screen or photo, and readable
router.post('/check-image', requireAuth, async (req, res, next) => {
  const { kind, image, lang } = req.body
  if (!PROOF_IDS.includes(kind) || !isUpload(image)) return res.status(400).json({ error: 'invalid_input' })
  if (!underImageLimit(req.user.id)) return res.status(429).json({ error: 'appraisal_limit' })
  try {
    res.json(await checkProofImage(kind, image, { lang: lang === 'he' ? 'he' : 'en' }))
  } catch (err) {
    if (err instanceof AppraisalUnavailableError) return res.status(503).json({ error: 'ai_unavailable' })
    next(err)
  }
})

// Inspects a device's screenshots and photos with Claude and prices it
router.post('/', requireAuth, async (req, res, next) => {
  const { proofs, brand, model, condition, lang } = req.body
  if (!hasAllProofs(proofs)) return res.status(400).json({ error: 'missing_proofs' })

  const { n } = db
    .prepare('SELECT COUNT(*) AS n FROM appraisals WHERE user_id = ? AND created_at > ?')
    .get(req.user.id, Date.now() - 86_400_000)
  if (n >= DAILY_LIMIT) return res.status(429).json({ error: 'appraisal_limit' })

  try {
    const facts = await extractPhoneFacts(proofs, { sellerBrand: brand, sellerModel: model, lang: lang === 'he' ? 'he' : 'en' })
    const valuation = estimatePhoneValue(facts, { condition })
    const id = db
      .prepare('INSERT INTO appraisals (user_id, proofs_hash, facts, valuation, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(req.user.id, proofsHash(proofs), JSON.stringify(facts), JSON.stringify(valuation), Date.now()).lastInsertRowid
    res.json({ appraisal: { id: Number(id), facts, valuation } })
  } catch (err) {
    if (err instanceof AppraisalUnavailableError) {
      console.warn('Appraisal unavailable:', err.message)
      return res.status(503).json({ error: 'ai_unavailable' })
    }
    next(err)
  }
})

// The facts a listing may carry: from an appraisal owned by the seller and made from exactly these images.
// The caller prices them with the listing's declared condition.
export function appraisalForListing(appraisalId, userId, proofs) {
  if (!appraisalId) return null
  const row = db.prepare('SELECT * FROM appraisals WHERE id = ? AND user_id = ?').get(appraisalId, userId)
  if (!row || row.proofs_hash !== proofsHash(proofs)) return null
  return { facts: JSON.parse(row.facts) }
}

export default router
