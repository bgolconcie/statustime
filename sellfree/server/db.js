import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'

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
    password_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS listings (
    id          INTEGER PRIMARY KEY,
    seller_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL,
    condition   TEXT NOT NULL,
    price       REAL NOT NULL,
    currency    TEXT NOT NULL,
    age_groups  TEXT NOT NULL,            -- JSON array of age group ids
    image       TEXT,                     -- data URL thumbnail
    i18n        TEXT,                     -- optional JSON { title: { en, he }, description: { en, he } }
    status      TEXT NOT NULL DEFAULT 'available',
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

// Demo data so a fresh install has something to browse and chat about
function seed() {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return

  const now = Date.now()
  const hash = bcrypt.hashSync('demo1234', 10)
  const addUser = db.prepare('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
  const dana = addUser.run('Dana', 'dana@sellfree.test', hash, now).lastInsertRowid
  const yossi = addUser.run('Yossi', 'yossi@sellfree.test', hash, now).lastInsertRowid

  const addListing = db.prepare(`
    INSERT INTO listings (seller_id, title, description, category, condition, price, currency, age_groups, i18n, created_at)
    VALUES ($seller, $title, $description, $category, $condition, $price, 'ILS', $ages, $i18n, $createdAt)
  `)
  const items = [
    [dana, ['Wooden stacking blocks', 'קוביות עץ להרכבה'], ['30 blocks, natural wood.', '30 קוביות, עץ טבעי.'], 'toys', 'good', 45, ['baby', 'kids']],
    [dana, ['Kids bike 16"', 'אופני ילדים 16 אינץ\''], ['Training wheels included.', 'כולל גלגלי עזר.'], 'sports', 'likeNew', 220, ['kids']],
    [dana, ['Baby clothes bundle 6–12m', 'חבילת בגדי תינוקות 6–12 חודשים'], ['15 pieces, mostly cotton.', '15 פריטים, רובם כותנה.'], 'clothing', 'good', 70, ['baby']],
    [yossi, ['Harry Potter box set', 'סדרת הארי פוטר'], ['All 7 books, paperback.', 'כל 7 הספרים, כריכה רכה.'], 'books', 'good', 120, ['kids', 'teens', 'adults']],
    [yossi, ['Gaming headset', 'אוזניות גיימינג'], ['Wired, USB + 3.5mm.', 'חוטיות, USB ו-3.5 מ"מ.'], 'electronics', 'likeNew', 150, ['teens', 'adults']],
    [yossi, ['Office chair', 'כיסא משרדי'], ['Free, pick up only.', 'בחינם, איסוף עצמי בלבד.'], 'furniture', 'fair', 0, ['adults', 'seniors']],
    [yossi, ['Large-print crossword books', 'חוברות תשבצים באותיות גדולות'], ['Set of 3, unused.', 'סט של 3, לא בשימוש.'], 'books', 'new', 30, ['seniors']],
  ]
  const ids = items.map(([seller, [en, he], [dEn, dHe], category, condition, price, ages], i) =>
    addListing.run({
      seller,
      title: he,
      description: dHe,
      category,
      condition,
      price,
      ages: JSON.stringify(ages),
      i18n: JSON.stringify({ title: { en, he }, description: { en: dEn, he: dHe } }),
      createdAt: now - i * 3_600_000,
    }).lastInsertRowid
  )

  // Yossi asks Dana about the blocks
  const convo = db
    .prepare('INSERT INTO conversations (listing_id, buyer_id, seller_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(ids[0], yossi, dana, now, now).lastInsertRowid
  const addMessage = db.prepare('INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)')
  addMessage.run(convo, yossi, 'היי, הקוביות עדיין זמינות?', now - 120_000)
  const last = addMessage.run(convo, dana, 'כן! אפשר לאסוף מחר בערב.', now - 60_000).lastInsertRowid
  db.prepare('UPDATE conversations SET buyer_read_id = ?, seller_read_id = ? WHERE id = ?').run(last - 1, last, convo)
}

transaction(seed)
