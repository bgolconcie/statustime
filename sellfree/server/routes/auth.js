import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { OAuth2Client } from 'google-auth-library'
import { db } from '../db.js'
import { publicUser, requireAuth, signToken } from '../auth.js'

const router = Router()
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Google sign-in is on when GOOGLE_CLIENT_ID is set
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || null
const google = GOOGLE_CLIENT_ID && new OAuth2Client(GOOGLE_CLIENT_ID)


router.get('/config', (req, res) => {
  // Sample accounts are only created off a live server (see db.js)
  res.json({ googleClientId: GOOGLE_CLIENT_ID, sampleAccounts: process.env.NODE_ENV !== 'production' })
})


router.post('/register', (req, res) => {
  const name = String(req.body.name ?? '').trim()
  const email = String(req.body.email ?? '').trim().toLowerCase()
  const password = String(req.body.password ?? '')
  if (!name || name.length > 60 || !EMAIL.test(email) || password.length < 6) {
    return res.status(400).json({ error: 'invalid_input' })
  }
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'email_taken' })
  }
  const id = db
    .prepare('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(name, email, bcrypt.hashSync(password, 10), Date.now()).lastInsertRowid
  const user = { id: Number(id), name, email }
  res.status(201).json({ token: signToken(user), user })
})

router.post('/login', (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase()
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!row || !row.password_hash || !bcrypt.compareSync(String(req.body.password ?? ''), row.password_hash)) {
    return res.status(401).json({ error: 'invalid_credentials' })
  }
  res.json({ token: signToken(row), user: publicUser(row) })
})

// Sign up or sign in with the ID token from Google's sign-in button
router.post('/google', async (req, res) => {
  if (!google) return res.status(404).json({ error: 'not_found' })

  let payload
  try {
    const ticket = await google.verifyIdToken({ idToken: String(req.body.credential ?? ''), audience: GOOGLE_CLIENT_ID })
    payload = ticket.getPayload()
  } catch {
    return res.status(401).json({ error: 'google_failed' })
  }
  if (!payload?.sub || !payload.email || !payload.email_verified) return res.status(401).json({ error: 'google_failed' })

  const email = payload.email.toLowerCase()
  let row = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(payload.sub)
  if (!row) {
    row = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (row) {
      // Google has verified this address, so it can join the existing account
      db.prepare('UPDATE users SET google_sub = ? WHERE id = ?').run(payload.sub, row.id)
    } else {
      const name = String(payload.name || email.split('@')[0]).slice(0, 60)
      const id = db
        .prepare("INSERT INTO users (name, email, password_hash, google_sub, created_at) VALUES (?, ?, '', ?, ?)")
        .run(name, email, payload.sub, Date.now()).lastInsertRowid
      row = { id: Number(id), name, email }
    }
  }
  res.json({ token: signToken(row), user: publicUser(row) })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

export default router
