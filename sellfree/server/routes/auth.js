import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db.js'
import { publicUser, requireAuth, signToken } from '../auth.js'

const router = Router()
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
  if (!row || !bcrypt.compareSync(String(req.body.password ?? ''), row.password_hash)) {
    return res.status(401).json({ error: 'invalid_credentials' })
  }
  res.json({ token: signToken(row), user: publicUser(row) })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

export default router
