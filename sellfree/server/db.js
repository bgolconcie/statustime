import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { CATEGORIES } from '../src/lib/catalog.js'
import { DEMO_CONVERSATION, DEMO_LISTINGS, DEMO_PASSWORD, DEMO_USERS } from '../src/lib/demoData.js'
import { estimatePhoneValue } from '../src/lib/valuation.js'

export const DATA_DIR = process.env.DATA_DIR ?? path.join(import.meta.dirname, 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

export const db = new DatabaseSync(path.join(DATA_DIR, 'sellfree.db'))

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,          -- '' for accounts that only sign in with Google
    google_sub    TEXT,                   -- Google account id, once signed in with Google
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS listings (
    id          INTEGER PRIMARY KEY,
    seller_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL,
    condition   TEXT NOT NULL,
    brand       TEXT NOT NULL DEFAULT '',
    model       TEXT NOT NULL DEFAULT '',
    price       REAL NOT NULL,
    currency    TEXT NOT NULL,
    age_groups  TEXT NOT NULL,            -- JSON array of age group ids
    image       TEXT,                     -- data URL thumbnail
    appraisal   TEXT,                     -- JSON { facts, valuation } read from the phone's screenshots
    i18n        TEXT,                     -- optional JSON { title: { en, he }, description: { en, he } }
    status      TEXT NOT NULL DEFAULT 'available',
    created_at  INTEGER NOT NULL
  );

  -- Required screenshots for phone listings, one per kind
  CREATE TABLE IF NOT EXISTS listing_proofs (
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    image      TEXT NOT NULL,             -- data URL
    PRIMARY KEY (listing_id, kind)
  );

  -- Claude's reading of a seller's screenshots, reusable when the listing is published
  CREATE TABLE IF NOT EXISTS appraisals (
    id          INTEGER PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    proofs_hash TEXT NOT NULL,
    facts       TEXT NOT NULL,
    valuation   TEXT,
    created_at  INTEGER NOT NULL
  );

  -- One conversation per buyer per listing
  CREATE TABLE IF NOT EXISTS conversations (
    id             INTEGER PRIMARY KEY,
    listing_id     INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    buyer_read_id  INTEGER NOT NULL DEFAULT 0,  -- last message id each side has seen
    seller_read_id INTEGER NOT NULL DEFAULT 0,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,
    UNIQUE (listing_id, buyer_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body            TEXT NOT NULL,
    created_at      INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id);
  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id);
`)

export function transaction(fn) {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

function addColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
  if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

function migrate() {
  const version = db.prepare('PRAGMA user_version').get().user_version
  // v2: brand and model
  if (version < 2) {
    addColumn('listings', 'brand', "TEXT NOT NULL DEFAULT ''")
    addColumn('listings', 'model', "TEXT NOT NULL DEFAULT ''")
  }
  // v3: phone listings carry a screenshot appraisal
  if (version < 3) addColumn('listings', 'appraisal', 'TEXT')
  // v4: the condition photo was replaced by a network-lock screenshot
  if (version < 4) db.exec("DELETE FROM listing_proofs WHERE kind = 'condition'")
  // v5: sign in with Google
  if (version < 5) addColumn('users', 'google_sub', 'TEXT')
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub)')
  // v6: the marketplace is limited to phones and tablets
  if (version < 6) {
    db.prepare(`DELETE FROM listings WHERE category NOT IN (${CATEGORIES.map(() => '?').join(', ')})`).run(...CATEGORIES)
  }
  db.exec('PRAGMA user_version = 6')
}

// Demo data so a fresh install has something to browse and chat about
function seed() {
  const now = Date.now()
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
    const hash = bcrypt.hashSync(DEMO_PASSWORD, 10)
    const addUser = db.prepare('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    for (const user of DEMO_USERS) addUser.run(user.name, user.email, hash, now)
  }
  if (db.prepare('SELECT COUNT(*) AS n FROM listings').get().n > 0) return

  const userIds = Object.fromEntries(
    DEMO_USERS.map((u) => [u.key, db.prepare('SELECT id FROM users WHERE email = ?').get(u.email)?.id])
  )
  if (!Object.values(userIds).every(Boolean)) return

  const addListing = db.prepare(`
    INSERT INTO listings (seller_id, title, description, category, condition, brand, model, price, currency, age_groups, image, i18n, appraisal, created_at)
    VALUES ($seller, $title, $description, $category, $condition, $brand, $model, $price, 'ILS', $ages, $image, $i18n, $appraisal, $createdAt)
  `)
  const addProof = db.prepare('INSERT INTO listing_proofs (listing_id, kind, image) VALUES (?, ?, ?)')
  const ids = DEMO_LISTINGS.map((item, i) => {
    const id = addListing.run({
      seller: userIds[item.seller],
      title: item.title,
      description: item.description,
      category: item.category,
      condition: item.condition,
      brand: item.brand,
      model: item.model,
      price: item.price,
      ages: JSON.stringify(item.ageGroups),
      image: item.image,
      i18n: JSON.stringify(item.i18n),
      appraisal: item.facts
        ? JSON.stringify({ facts: item.facts, valuation: estimatePhoneValue(item.facts, { condition: item.condition }) })
        : null,
      createdAt: now - i * 3_600_000,
    }).lastInsertRowid
    for (const proof of item.proofs ?? []) addProof.run(id, proof.kind, proof.image)
    return id
  })

  const { listing, buyer, seller, messages } = DEMO_CONVERSATION
  const convo = db
    .prepare('INSERT INTO conversations (listing_id, buyer_id, seller_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(ids[listing], userIds[buyer], userIds[seller], now, now).lastInsertRowid
  const addMessage = db.prepare('INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)')
  const messageIds = messages.map((m) => addMessage.run(convo, userIds[m.from], m.body, now - m.ago).lastInsertRowid)
  // The buyer hasn't read the seller's reply yet
  db.prepare('UPDATE conversations SET buyer_read_id = ?, seller_read_id = ? WHERE id = ?')
    .run(messageIds.at(-2), messageIds.at(-1), convo)
}

transaction(() => {
  migrate()
  seed()
})
