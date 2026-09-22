import { Router } from 'express'
import { db, transaction } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()
router.use(requireAuth)

// Conversations the user is part of. A seller only sees one once the buyer has written something.
const VISIBLE = `
  (c.buyer_id = $me OR (c.seller_id = $me AND EXISTS (SELECT 1 FROM messages WHERE conversation_id = c.id)))
`
const UNREAD = `
  (SELECT COUNT(*) FROM messages m
   WHERE m.conversation_id = c.id AND m.sender_id != $me
     AND m.id > CASE WHEN c.buyer_id = $me THEN c.buyer_read_id ELSE c.seller_read_id END)
`

function toSummary(row, me) {
  return {
    id: row.id,
    role: row.buyer_id === me ? 'buyer' : 'seller',
    otherName: row.other_name,
    listing: {
      id: row.listing_id,
      title: row.title,
      image: row.image,
      i18n: row.i18n ? JSON.parse(row.i18n) : null,
      price: row.price,
      currency: row.currency,
      status: row.status,
    },
    lastMessage: row.last_body == null ? null : { body: row.last_body, mine: row.last_sender === me, createdAt: row.last_at },
    unread: row.unread,
    updatedAt: row.updated_at,
  }
}

const SUMMARY = `
  SELECT c.*, l.title, l.image, l.i18n, l.price, l.currency, l.status,
    CASE WHEN c.buyer_id = $me THEN s.name ELSE b.name END AS other_name,
    lm.body AS last_body, lm.sender_id AS last_sender, lm.created_at AS last_at,
    ${UNREAD} AS unread
  FROM conversations c
  JOIN listings l ON l.id = c.listing_id
  JOIN users b ON b.id = c.buyer_id
  JOIN users s ON s.id = c.seller_id
  LEFT JOIN messages lm ON lm.id = (SELECT MAX(id) FROM messages WHERE conversation_id = c.id)
`

router.get('/', (req, res) => {
  const me = req.user.id
  const rows = db.prepare(`${SUMMARY} WHERE ${VISIBLE} ORDER BY c.updated_at DESC`).all({ me })
  res.json({ conversations: rows.map((r) => toSummary(r, me)) })
})

router.get('/unread', (req, res) => {
  const { total } = db
    .prepare(`SELECT COALESCE(SUM(${UNREAD}), 0) AS total FROM conversations c WHERE ${VISIBLE}`)
    .get({ me: req.user.id })
  res.json({ unread: total })
})

function participant(req, res) {
  const me = req.user.id
  const row = db.prepare(`${SUMMARY} WHERE c.id = $id`).get({ me, id: req.params.id })
  if (!row) return res.status(404).json({ error: 'not_found' }), null
  if (row.buyer_id !== me && row.seller_id !== me) return res.status(403).json({ error: 'forbidden' }), null
  return row
}

function toMessage(row, me) {
  return { id: row.id, body: row.body, mine: row.sender_id === me, createdAt: row.created_at }
}

// Messages newer than ?after=<id>; also marks them as read
router.get('/:id', (req, res) => {
  const row = participant(req, res)
  if (!row) return
  const me = req.user.id
  const after = Number(req.query.after) || 0
  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id').all(row.id, after)
  if (messages.length) {
    const column = row.buyer_id === me ? 'buyer_read_id' : 'seller_read_id'
    db.prepare(`UPDATE conversations SET ${column} = MAX(${column}, ?) WHERE id = ?`).run(messages.at(-1).id, row.id)
  }
  res.json({ conversation: toSummary(row, me), messages: messages.map((m) => toMessage(m, me)) })
})

router.post('/:id/messages', (req, res) => {
  const row = participant(req, res)
  if (!row) return
  const body = String(req.body.body ?? '').trim()
  if (!body || body.length > 2000) return res.status(400).json({ error: 'invalid_input' })

  const me = req.user.id
  const now = Date.now()
  const message = transaction(() => {
    const id = db
      .prepare('INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)')
      .run(row.id, me, body, now).lastInsertRowid
    const column = row.buyer_id === me ? 'buyer_read_id' : 'seller_read_id'
    db.prepare(`UPDATE conversations SET updated_at = ?, ${column} = ? WHERE id = ?`).run(now, id, row.id)
    return db.prepare('SELECT * FROM messages WHERE id = ?').get(id)
  })
  res.status(201).json({ message: toMessage(message, me) })
})

export default router
