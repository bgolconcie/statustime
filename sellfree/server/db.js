import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { CATEGORIES } from '../src/lib/catalog.js'

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
    brand       TEXT NOT NULL DEFAULT '',
    model       TEXT NOT NULL DEFAULT '',
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

// v2: the marketplace is limited to phones, computers and TVs
function migrate() {
  if (db.prepare('PRAGMA user_version').get().user_version >= 2) return
  const columns = db.prepare('PRAGMA table_info(listings)').all().map((c) => c.name)
  if (!columns.includes('brand')) db.exec("ALTER TABLE listings ADD COLUMN brand TEXT NOT NULL DEFAULT ''")
  if (!columns.includes('model')) db.exec("ALTER TABLE listings ADD COLUMN model TEXT NOT NULL DEFAULT ''")
  db.prepare(`DELETE FROM listings WHERE category NOT IN (${CATEGORIES.map(() => '?').join(', ')})`).run(...CATEGORIES)
  db.exec('PRAGMA user_version = 2')
}

// Demo data so a fresh install has something to browse and chat about
function seed() {
  const now = Date.now()
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
    const hash = bcrypt.hashSync('demo1234', 10)
    const addUser = db.prepare('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    addUser.run('Dana', 'dana@sellfree.test', hash, now)
    addUser.run('Yossi', 'yossi@sellfree.test', hash, now)
  }
  if (db.prepare('SELECT COUNT(*) AS n FROM listings').get().n > 0) return

  const userId = (email) => db.prepare('SELECT id FROM users WHERE email = ?').get(email)?.id
  const dana = userId('dana@sellfree.test')
  const yossi = userId('yossi@sellfree.test')
  if (!dana || !yossi) return

  const addListing = db.prepare(`
    INSERT INTO listings (seller_id, title, description, category, condition, brand, model, price, currency, age_groups, i18n, created_at)
    VALUES ($seller, $title, $description, $category, $condition, $brand, $model, $price, 'ILS', $ages, $i18n, $createdAt)
  `)
  const items = [
    [dana, 'phones', 'Apple', 'iPhone 13', ['iPhone 13, 128GB, blue', 'iPhone 13, 128GB, כחול'], ['Battery 87%, always used with a case.', 'סוללה 87%, תמיד היה עם כיסוי.'], 'likeNew', 1900, ['teens', 'adults']],
    [dana, 'phones', 'Samsung', 'Galaxy A14', ['Samsung Galaxy A14 — great first phone', 'Samsung Galaxy A14 — טלפון ראשון מעולה'], ['Simple and durable, parental controls set up.', 'פשוט ועמיד, מוגדרות הגבלות הורים.'], 'good', 450, ['kids', 'teens']],
    [dana, 'computers', 'Lenovo', 'IdeaPad 3', ['Lenovo IdeaPad 3 laptop, 15.6"', 'מחשב נייד Lenovo IdeaPad 3, 15.6 אינץ\''], ['Ryzen 5, 8GB RAM, 256GB SSD. Good for school.', 'Ryzen 5, 8GB RAM, 256GB SSD. מתאים ללימודים.'], 'good', 1300, ['kids', 'teens', 'adults']],
    [yossi, 'computers', 'Apple', 'MacBook Air M1', ['MacBook Air M1, 2020', 'MacBook Air M1, 2020'], ['8GB / 256GB, 180 battery cycles, charger included.', '8GB / 256GB, 180 מחזורי סוללה, כולל מטען.'], 'likeNew', 2800, ['teens', 'adults']],
    [yossi, 'tvs', 'LG', '55UQ7500', ['LG 55" 4K smart TV', 'טלוויזיה חכמה LG 55 אינץ\' 4K'], ['With remote and wall mount. Pick up in Tel Aviv.', 'כולל שלט ומתקן תלייה. איסוף מתל אביב.'], 'good', 1500, ['adults', 'seniors']],
    [yossi, 'tvs', 'Samsung', 'UE32T4300', ['Samsung 32" TV', 'טלוויזיה Samsung 32 אינץ\''], ['Simple, big buttons on the remote.', 'פשוטה, שלט עם כפתורים גדולים.'], 'good', 400, ['kids', 'adults', 'seniors']],
    [yossi, 'phones', 'Nokia', '105', ['Nokia 105 — basic phone, large keys', 'Nokia 105 — טלפון בסיסי עם מקשים גדולים'], ['Long battery life, easy to use.', 'סוללה שמחזיקה הרבה, קל לשימוש.'], 'new', 120, ['seniors']],
    [dana, 'phones', 'Xiaomi', 'Redmi Note 10', ['Xiaomi Redmi Note 10, cracked screen', 'Xiaomi Redmi Note 10, מסך סדוק'], ['Works, but the screen is cracked. For parts or repair.', 'עובד, אבל המסך סדוק. לחלקים או לתיקון.'], 'forParts', 150, ['adults']],
  ]
  const ids = items.map(([seller, category, brand, model, [en, he], [dEn, dHe], condition, price, ages], i) =>
    addListing.run({
      seller,
      title: he,
      description: dHe,
      category,
      condition,
      brand,
      model,
      price,
      ages: JSON.stringify(ages),
      i18n: JSON.stringify({ title: { en, he }, description: { en: dEn, he: dHe } }),
      createdAt: now - i * 3_600_000,
    }).lastInsertRowid
  )

  // Yossi asks Dana about the iPhone
  const convo = db
    .prepare('INSERT INTO conversations (listing_id, buyer_id, seller_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(ids[0], yossi, dana, now, now).lastInsertRowid
  const addMessage = db.prepare('INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)')
  addMessage.run(convo, yossi, 'היי, האייפון עדיין זמין? מה מצב הסוללה?', now - 120_000)
  const last = addMessage.run(convo, dana, 'כן! הסוללה 87%, אפשר לבוא לראות מחר.', now - 60_000).lastInsertRowid
  db.prepare('UPDATE conversations SET buyer_read_id = ?, seller_read_id = ? WHERE id = ?').run(last - 1, last, convo)
}

transaction(() => {
  migrate()
  seed()
})
