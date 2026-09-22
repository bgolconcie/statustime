import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import jwt from 'jsonwebtoken'
import { DATA_DIR, db } from './db.js'

// Use JWT_SECRET when set, otherwise a random secret kept next to the database
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  const file = path.join(DATA_DIR, 'jwt-secret')
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600 })
  return fs.readFileSync(file, 'utf8').trim()
}

const SECRET = loadSecret()

export function signToken(user) {
  return jwt.sign({ sub: user.id }, SECRET, { expiresIn: '30d' })
}

export function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email }
}

export function requireAuth(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer /, '')
  try {
    const { sub } = jwt.verify(token ?? '', SECRET)
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(sub)
    if (!user) throw new Error('unknown user')
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'unauthorized' })
  }
}
