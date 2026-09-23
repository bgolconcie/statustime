// In-browser stand-in for the SellFree server, used by the shareable demo build.
// Same routes and response shapes as server/routes/*; data lives in this browser only.
import { AGE_GROUPS, CATEGORIES, CONDITIONS, PHONE_PROOFS, needsProofs } from '@/lib/catalog'
import { DEMO_CONVERSATION, DEMO_LISTINGS, DEMO_PASSWORD, DEMO_USERS } from '@/lib/demoData'
import { estimatePhoneValue } from '@/lib/valuation'

const TOKEN_KEY = 'sellfree.token'
const DB_KEY = 'sellfree.demo.db.v2'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Session just won't survive a reload
  }
}

export class ApiError extends Error {
  constructor(code, status) {
    super(code)
    this.code = code
    this.status = status
  }
}

// ---- storage ---------------------------------------------------------------

function seed() {
  const now = Date.now()
  const users = DEMO_USERS.map((u, i) => ({ id: i + 1, name: u.name, email: u.email, password: DEMO_PASSWORD, key: u.key }))
  const idOf = (key) => users.find((u) => u.key === key).id
  const listings = DEMO_LISTINGS.map((item, i) => ({
    id: i + 1,
    sellerId: idOf(item.seller),
    title: item.title,
    description: item.description,
    category: item.category,
    condition: item.condition,
    brand: item.brand,
    model: item.model,
    price: item.price,
    currency: 'ILS',
    ageGroups: item.ageGroups,
    image: null,
    i18n: item.i18n,
    status: 'available',
    proofs: item.proofs ?? [],
    appraisal: item.facts ? { facts: item.facts, valuation: estimatePhoneValue(item.facts, { condition: item.condition }) } : null,
    createdAt: now - i * 3_600_000,
  }))
  const c = DEMO_CONVERSATION
  const messages = c.messages.map((m, i) => ({ id: i + 1, conversationId: 1, senderId: idOf(m.from), body: m.body, createdAt: now - m.ago }))
  const conversations = [
    {
      id: 1,
      listingId: listings[c.listing].id,
      buyerId: idOf(c.buyer),
      sellerId: idOf(c.seller),
      buyerReadId: messages.at(-2).id,
      sellerReadId: messages.at(-1).id,
      createdAt: now,
      updatedAt: now,
    },
  ]
  return { users, listings, conversations, messages, appraisals: [], nextId: 100 }
}

function load() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // Fall back to fresh sample data
  }
  return seed()
}

const db = load()

function save() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    // Storage full or blocked — keep working in memory
  }
}

export function resetDemo() {
  try {
    localStorage.removeItem(DB_KEY)
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing stored
  }
}

const nextId = () => ++db.nextId

// Short fingerprint of a set of screenshots, so appraisals don't store the images again
function fingerprint(proofs) {
  let h = 5381
  for (const s of PHONE_PROOFS.map((k) => proofs?.[k] ?? '')) {
    for (let i = 0; i < s.length; i += 7) h = ((h << 5) + h + s.charCodeAt(i)) | 0
    h = ((h << 5) + h + s.length) | 0
  }
  return h
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (code, status = 400) => {
  throw new ApiError(code, status)
}

// ---- shapes (mirror the server) --------------------------------------------

const userById = (id) => db.users.find((u) => u.id === id)
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email })

function toListing(l, { withProofs = false } = {}) {
  const { proofs, sellerId, ...rest } = l
  return {
    ...rest,
    sellerId,
    sellerName: userById(sellerId)?.name,
    proofCount: proofs.length,
    ...(withProofs && { proofs }),
  }
}

function unreadFor(c, me) {
  const readId = c.buyerId === me ? c.buyerReadId : c.sellerReadId
  return db.messages.filter((m) => m.conversationId === c.id && m.senderId !== me && m.id > readId).length
}

function visible(c, me) {
  return c.buyerId === me || (c.sellerId === me && db.messages.some((m) => m.conversationId === c.id))
}

function toSummary(c, me) {
  const l = db.listings.find((x) => x.id === c.listingId)
  const last = db.messages.filter((m) => m.conversationId === c.id).at(-1)
  return {
    id: c.id,
    role: c.buyerId === me ? 'buyer' : 'seller',
    otherName: userById(c.buyerId === me ? c.sellerId : c.buyerId)?.name,
    listing: {
      id: l.id, title: l.title, category: l.category, image: l.image, i18n: l.i18n,
      price: l.price, currency: l.currency, status: l.status,
    },
    lastMessage: last ? { body: last.body, mine: last.senderId === me, createdAt: last.createdAt } : null,
    unread: unreadFor(c, me),
    updatedAt: c.updatedAt,
  }
}

const toMessage = (m, me) => ({ id: m.id, body: m.body, mine: m.senderId === me, createdAt: m.createdAt })

// ---- auth ------------------------------------------------------------------

function currentUser() {
  const id = Number(/^demo-(\d+)$/.exec(getToken() ?? '')?.[1])
  return userById(id) ?? null
}

function requireUser() {
  return currentUser() ?? fail('unauthorized', 401)
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ---- demo conveniences -----------------------------------------------------

const lang = () => (document.documentElement.lang === 'he' ? 'he' : 'en')

const REPLIES = {
  he: ['היי! כן, עדיין זמין 🙂', 'אפשר לבוא לראות מחר אחרי 18:00.', 'על המחיר אפשר לדבר, תציעו.'],
  en: ['Hi! Yes, it’s still available 🙂', 'You can come see it tomorrow after 6pm.', 'The price is open to offers.'],
}

// The other side of a demo chat answers on its own so one person can try the whole flow
function scheduleReply(conversationId, fromId) {
  setTimeout(() => {
    const c = db.conversations.find((x) => x.id === conversationId)
    if (!c) return
    const replies = REPLIES[lang()]
    const count = db.messages.filter((m) => m.conversationId === c.id && m.senderId === fromId).length
    db.messages.push({ id: nextId(), conversationId: c.id, senderId: fromId, body: replies[count % replies.length], createdAt: Date.now() })
    c.updatedAt = Date.now()
    save()
  }, 2500)
}

const LAUNCH_PRICES = [
  [/iphone 1[56]/i, 4300], [/iphone 14/i, 3900], [/iphone 13/i, 3700], [/iphone 12/i, 3500], [/iphone 11/i, 3200],
  [/galaxy s2[345]/i, 3600], [/galaxy a/i, 1100], [/pixel/i, 3000], [/redmi|xiaomi/i, 1200],
]

// Simulated reading of the screenshots (the real app sends them to Claude)
function simulatedFacts({ brand, model }) {
  const name = `${brand ?? ''} ${model ?? ''}`.trim() || 'Apple iPhone 13'
  const launchPriceIls = LAUNCH_PRICES.find(([re]) => re.test(name))?.[1] ?? 2500
  return {
    brand: brand || 'Apple',
    model: model || 'iPhone 13',
    storageGb: 128,
    purchaseDate: '2022-09',
    releaseYear: 2022,
    batteryHealthPct: 86,
    nonGenuineParts: [],
    diagnosticsPassed: true,
    networkLocked: false,
    launchPriceIls,
    confidence: 'medium',
    issues: [
      lang() === 'he'
        ? 'הדגמה: הנתונים כאן מדומים. באפליקציה האמיתית הם נקראים מצילומי המסך.'
        : 'Demo: these facts are simulated. In the real app they are read from the screenshots.',
    ],
  }
}

// ---- routes ----------------------------------------------------------------

function parseListing(body) {
  const title = String(body.title ?? '').trim()
  const brand = String(body.brand ?? '').trim()
  const price = Number(body.price)
  const ageGroups = Array.isArray(body.ageGroups) ? [...new Set(body.ageGroups)] : []
  const valid =
    title && brand && CATEGORIES.includes(body.category) && CONDITIONS.includes(body.condition) &&
    Number.isFinite(price) && price >= 0 && ageGroups.length > 0 && ageGroups.every((g) => AGE_GROUPS.some((a) => a.id === g))
  // A photo of the item is required
  if (!valid || typeof body.image !== 'string' || !body.image.startsWith('data:image/')) fail('invalid_input')
  return {
    title, brand,
    model: String(body.model ?? '').trim(),
    description: String(body.description ?? '').trim(),
    category: body.category, condition: body.condition, price, currency: body.currency, ageGroups,
    image: body.image,
  }
}

function ownListing(id, me) {
  const l = db.listings.find((x) => x.id === id) ?? fail('not_found', 404)
  if (l.sellerId !== me.id) fail('forbidden', 403)
  return l
}

function participant(id, me) {
  const c = db.conversations.find((x) => x.id === id) ?? fail('not_found', 404)
  if (c.buyerId !== me.id && c.sellerId !== me.id) fail('forbidden', 403)
  return c
}

const routes = [
  ['POST', /^\/auth\/register$/, (_, body) => {
    const name = String(body.name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!name || !EMAIL.test(email) || String(body.password ?? '').length < 6) fail('invalid_input')
    if (db.users.some((u) => u.email === email)) fail('email_taken', 409)
    const user = { id: nextId(), name, email, password: body.password }
    db.users.push(user)
    return { token: `demo-${user.id}`, user: publicUser(user) }
  }],
  ['POST', /^\/auth\/login$/, (_, body) => {
    const user = db.users.find((u) => u.email === String(body.email ?? '').trim().toLowerCase())
    if (!user || !user.password || user.password !== body.password) fail('invalid_credentials', 401)
    return { token: `demo-${user.id}`, user: publicUser(user) }
  }],
  ['GET', /^\/auth\/me$/, () => ({ user: publicUser(requireUser()) })],
  ['GET', /^\/auth\/config$/, () => ({ googleClientId: 'demo' })],
  // Simulated Google sign-in: one stand-in Gmail account per browser
  ['POST', /^\/auth\/google$/, () => {
    const email = 'gmail.demo@example.com'
    let user = db.users.find((u) => u.email === email)
    if (!user) {
      user = { id: nextId(), name: lang() === 'he' ? 'משתמש Gmail' : 'Gmail user', email, password: null }
      db.users.push(user)
    }
    return { token: `demo-${user.id}`, user: publicUser(user) }
  }],

  ['GET', /^\/listings\?mine=1$/, () => {
    const me = requireUser()
    return { listings: db.listings.filter((l) => l.sellerId === me.id).sort((a, b) => b.createdAt - a.createdAt).map((l) => toListing(l)) }
  }],
  ['GET', /^\/listings$/, () => ({
    listings: db.listings.filter((l) => l.status === 'available').sort((a, b) => b.createdAt - a.createdAt).map((l) => toListing(l)),
  })],
  ['GET', /^\/listings\/(\d+)$/, ([id]) => {
    const l = db.listings.find((x) => x.id === Number(id)) ?? fail('not_found', 404)
    return { listing: toListing(l, { withProofs: true }) }
  }],
  ['POST', /^\/listings$/, (_, body) => {
    const me = requireUser()
    const data = parseListing(body)
    const isPhone = needsProofs(data.category)
    const proofs = isPhone ? PHONE_PROOFS.map((kind) => ({ kind, image: body.proofs?.[kind] })) : []
    if (!proofs.every((p) => typeof p.image === 'string' && p.image.startsWith('data:image/'))) fail('missing_proofs')
    const read = isPhone && db.appraisals.find((a) => a.id === body.appraisalId && a.userId === me.id && a.fingerprint === fingerprint(body.proofs))
    const listing = {
      id: nextId(), sellerId: me.id, ...data, i18n: null, status: 'available', proofs, createdAt: Date.now(),
      appraisal: read ? { facts: read.facts, valuation: estimatePhoneValue(read.facts, { condition: data.condition }) } : null,
    }
    db.listings.push(listing)
    return { listing: toListing(listing) }
  }],
  ['PATCH', /^\/listings\/(\d+)$/, ([id], body) => {
    const l = ownListing(Number(id), requireUser())
    if (!['available', 'sold'].includes(body.status)) fail('invalid_input')
    l.status = body.status
    return { listing: toListing(l) }
  }],
  ['DELETE', /^\/listings\/(\d+)$/, ([id]) => {
    const l = ownListing(Number(id), requireUser())
    db.listings = db.listings.filter((x) => x !== l)
    const gone = db.conversations.filter((c) => c.listingId === l.id).map((c) => c.id)
    db.conversations = db.conversations.filter((c) => !gone.includes(c.id))
    db.messages = db.messages.filter((m) => !gone.includes(m.conversationId))
    return null
  }],
  ['POST', /^\/listings\/(\d+)\/conversations$/, ([id]) => {
    const me = requireUser()
    const l = db.listings.find((x) => x.id === Number(id)) ?? fail('not_found', 404)
    if (l.sellerId === me.id) fail('own_listing')
    let c = db.conversations.find((x) => x.listingId === l.id && x.buyerId === me.id)
    if (!c) {
      c = { id: nextId(), listingId: l.id, buyerId: me.id, sellerId: l.sellerId, buyerReadId: 0, sellerReadId: 0, createdAt: Date.now(), updatedAt: Date.now() }
      db.conversations.push(c)
    }
    return { conversationId: c.id }
  }],

  ['GET', /^\/conversations$/, () => {
    const me = requireUser().id
    return {
      conversations: db.conversations.filter((c) => visible(c, me)).sort((a, b) => b.updatedAt - a.updatedAt).map((c) => toSummary(c, me)),
    }
  }],
  ['GET', /^\/conversations\/unread$/, () => {
    const me = requireUser().id
    return { unread: db.conversations.filter((c) => visible(c, me)).reduce((n, c) => n + unreadFor(c, me), 0) }
  }],
  ['GET', /^\/conversations\/(\d+)(?:\?after=(\d+))?$/, ([id, after]) => {
    const me = requireUser()
    const c = participant(Number(id), me)
    const messages = db.messages.filter((m) => m.conversationId === c.id && m.id > (Number(after) || 0))
    if (messages.length) {
      const key = c.buyerId === me.id ? 'buyerReadId' : 'sellerReadId'
      c[key] = Math.max(c[key], messages.at(-1).id)
    }
    return { conversation: toSummary(c, me.id), messages: messages.map((m) => toMessage(m, me.id)) }
  }],
  ['POST', /^\/conversations\/(\d+)\/messages$/, ([id], body) => {
    const me = requireUser()
    const c = participant(Number(id), me)
    const text = String(body.body ?? '').trim()
    if (!text || text.length > 2000) fail('invalid_input')
    const message = { id: nextId(), conversationId: c.id, senderId: me.id, body: text, createdAt: Date.now() }
    db.messages.push(message)
    c.updatedAt = message.createdAt
    c[c.buyerId === me.id ? 'buyerReadId' : 'sellerReadId'] = message.id
    const other = c.buyerId === me.id ? c.sellerId : c.buyerId
    if (DEMO_USERS.some((u) => userById(other)?.email === u.email)) scheduleReply(c.id, other)
    return { message: toMessage(message, me.id) }
  }],

  ['POST', /^\/appraisals$/, async (_, body) => {
    const me = requireUser()
    if (!PHONE_PROOFS.every((k) => body.proofs?.[k])) fail('missing_proofs')
    await sleep(2500)
    const facts = simulatedFacts(body)
    const appraisal = { id: nextId(), userId: me.id, fingerprint: fingerprint(body.proofs), facts }
    db.appraisals = [...db.appraisals.slice(-19), appraisal]
    return { appraisal: { id: appraisal.id, facts, valuation: estimatePhoneValue(facts, { condition: body.condition }) } }
  }],
]

export async function api(path, { method = 'GET', body } = {}) {
  await sleep(120)
  const [, handler, params] =
    routes
      .map(([m, re, fn]) => (m === method ? [m, fn, re.exec(path)] : [m, fn, null]))
      .find(([, , match]) => match) ?? []
  if (!handler) throw new ApiError('not_found', 404)
  const result = await handler(params.slice(1), body ?? {})
  save()
  return result
}
