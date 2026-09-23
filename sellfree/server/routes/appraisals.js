import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'
import { hasAllProofs, proofsHash } from '../images.js'
import { AppraisalUnavailableError, extractPhoneFacts } from '../appraisal.js'
import { estimatePhoneValue } from '../../src/lib/valuation.js'

const router = Router()
const DAILY_LIMIT = 20

// Reads a phone's 5 screenshots with Claude and prices it
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

// The facts a listing may carry: from an appraisal owned by the seller and made from exactly these screenshots.
// The caller prices them with the listing's declared condition.
export function appraisalForListing(appraisalId, userId, proofs) {
  if (!appraisalId) return null
  const row = db.prepare('SELECT * FROM appraisals WHERE id = ? AND user_id = ?').get(appraisalId, userId)
  if (!row || row.proofs_hash !== proofsHash(proofs)) return null
  return { facts: JSON.parse(row.facts) }
}

export default router
