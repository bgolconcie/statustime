import { Router } from 'express'
import { db, transaction } from '../db.js'
import { requireAuth } from '../auth.js'
import { hasAllProofs } from '../images.js'
import { appraisalForListing } from './appraisals.js'
import { estimatePhoneValue } from '../../src/lib/valuation.js'
import { AGE_GROUPS, CATEGORIES, CONDITIONS, COVER_PROOF, PROOF_IDS } from '../../src/lib/catalog.js'

const router = Router()
const CURRENCIES = ['ILS', 'USD']

const SELECT = `
  SELECT l.*, u.name AS seller_name,
    (SELECT COUNT(*) FROM listing_proofs p WHERE p.listing_id = l.id) AS proof_count
  FROM listings l JOIN users u ON u.id = l.seller_id
`

export function toListing(row) {
  return {
    id: row.id,
    sellerId: row.seller_id,
    sellerName: row.seller_name,
    title: row.title,
    description: row.description,
    category: row.category,
    condition: row.condition,
    brand: row.brand,
    model: row.model,
    price: row.price,
    currency: row.currency,
    ageGroups: JSON.parse(row.age_groups),
    image: row.image,
    i18n: row.i18n ? JSON.parse(row.i18n) : null,
    status: row.status,
    proofCount: row.proof_count,
    appraisal: row.appraisal ? JSON.parse(row.appraisal) : null,
    createdAt: row.created_at,
  }
}

function parseListing(body) {
  const title = String(body.title ?? '').trim()
  const description = String(body.description ?? '').trim()
  const brand = String(body.brand ?? '').trim()
  const model = String(body.model ?? '').trim()
  const price = Number(body.price)
  const ageGroups = Array.isArray(body.ageGroups) ? [...new Set(body.ageGroups)] : []

  const valid =
    title && title.length <= 120 &&
    description.length <= 2000 &&
    brand && brand.length <= 40 &&
    model.length <= 80 &&
    CATEGORIES.includes(body.category) &&
    CONDITIONS.includes(body.condition) &&
    Number.isFinite(price) && price >= 0 && price <= 1_000_000 &&
    CURRENCIES.includes(body.currency) &&
    ageGroups.length > 0 && ageGroups.every((g) => AGE_GROUPS.some((a) => a.id === g))

  if (!valid) return null
  return { title, description, brand, model, category: body.category, condition: body.condition, price, currency: body.currency, ageGroups }
}

function ownListing(req, res) {
  const row = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not_found' }), null
  if (row.seller_id !== req.user.id) return res.status(403).json({ error: 'forbidden' }), null
  return row
}

// Public feed: available items only. ?mine=1 returns the signed-in seller's items in any status.
router.get('/', (req, res, next) => {
  if (req.query.mine) return requireAuth(req, res, next)
  const rows = db.prepare(`${SELECT} WHERE l.status = 'available' ORDER BY l.created_at DESC`).all()
  res.json({ listings: rows.map(toListing) })
})

router.get('/', (req, res) => {
  const rows = db.prepare(`${SELECT} WHERE l.seller_id = ? ORDER BY l.created_at DESC`).all(req.user.id)
  res.json({ listings: rows.map(toListing) })
})

router.get('/:id', (req, res) => {
  const row = db.prepare(`${SELECT} WHERE l.id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not_found' })
  const proofs = db.prepare('SELECT kind, image FROM listing_proofs WHERE listing_id = ?').all(row.id)
  const order = (p) => PROOF_IDS.indexOf(p.kind)
  res.json({ listing: { ...toListing(row), proofs: proofs.sort((a, b) => order(a) - order(b)) } })
})

// No cap on how many listings a seller can create
router.post('/', requireAuth, (req, res) => {
  const data = parseListing(req.body)
  if (!data) return res.status(400).json({ error: 'invalid_input' })

  // Every device comes with its required screenshots and photos; the scratch-check photo is the cover
  if (!hasAllProofs(req.body.proofs)) return res.status(400).json({ error: 'missing_proofs' })
  const proofs = PROOF_IDS.filter((kind) => req.body.proofs[kind]).map((kind) => [kind, req.body.proofs[kind]])
  const image = req.body.proofs[COVER_PROOF]

  const read = appraisalForListing(req.body.appraisalId, req.user.id, req.body.proofs)
  const appraisal = read && { facts: read.facts, valuation: estimatePhoneValue(read.facts, { condition: data.condition }) }

  const id = transaction(() => {
    const listingId = db
      .prepare(`
        INSERT INTO listings (seller_id, title, description, category, condition, brand, model, price, currency, age_groups, image, appraisal, created_at)
        VALUES ($seller, $title, $description, $category, $condition, $brand, $model, $price, $currency, $ageGroups, $image, $appraisal, $createdAt)
      `)
      .run({
        ...data,
        image,
        seller: req.user.id,
        ageGroups: JSON.stringify(data.ageGroups),
        appraisal: appraisal && JSON.stringify(appraisal),
        createdAt: Date.now(),
      }).lastInsertRowid
    const addProof = db.prepare('INSERT INTO listing_proofs (listing_id, kind, image) VALUES (?, ?, ?)')
    for (const [kind, image] of proofs) addProof.run(listingId, kind, image)
    return listingId
  })
  res.status(201).json({ listing: toListing(db.prepare(`${SELECT} WHERE l.id = ?`).get(id)) })
})

router.patch('/:id', requireAuth, (req, res) => {
  if (!ownListing(req, res)) return
  if (!['available', 'sold'].includes(req.body.status)) return res.status(400).json({ error: 'invalid_input' })
  db.prepare('UPDATE listings SET status = ? WHERE id = ?').run(req.body.status, req.params.id)
  res.json({ listing: toListing(db.prepare(`${SELECT} WHERE l.id = ?`).get(req.params.id)) })
})

router.delete('/:id', requireAuth, (req, res) => {
  if (!ownListing(req, res)) return
  db.prepare('DELETE FROM listings WHERE id = ?').run(req.params.id)
  res.status(204).end()
})

// Buyer opens (or reopens) a chat with the seller about this listing
router.post('/:id/conversations', requireAuth, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id)
  if (!listing) return res.status(404).json({ error: 'not_found' })
  if (listing.seller_id === req.user.id) return res.status(400).json({ error: 'own_listing' })

  const now = Date.now()
  db.prepare(`
    INSERT INTO conversations (listing_id, buyer_id, seller_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (listing_id, buyer_id) DO NOTHING
  `).run(listing.id, req.user.id, listing.seller_id, now, now)
  const { id } = db.prepare('SELECT id FROM conversations WHERE listing_id = ? AND buyer_id = ?').get(listing.id, req.user.id)
  res.json({ conversationId: id })
})

export default router
