const router = require('express').Router();
const Stripe = require('stripe');
const db = require('../db');
const auth = require('../middleware/auth');

// Lazily initialized — reads key at request time, not at module load
let _stripe = null;
function getStripe() {
  if (!_stripe) _stripe = new Stripe((process.env.STRIPE_SECRET_KEY || '').trim(), { apiVersion: '2023-10-16' });
  return _stripe;
}

// Founder orgs are exempt from any Stripe-driven plan/seat/status mutation.
// They keep whatever plan/seats are set in DB regardless of webhook activity.
const FOUNDER_EMAILS = (process.env.FOUNDER_EMAILS || 'bgol@benigo.com')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

async function isFounderOrgById(orgId) {
  if (!orgId) return false;
  const { rows } = await db.query('SELECT email FROM organizations WHERE id=$1', [orgId]);
  return rows.length > 0 && FOUNDER_EMAILS.includes((rows[0].email || '').toLowerCase());
}

async function isFounderOrgBySub(subId) {
  if (!subId) return false;
  const { rows } = await db.query('SELECT email FROM organizations WHERE stripe_subscription_id=$1', [subId]);
  return rows.length > 0 && FOUNDER_EMAILS.includes((rows[0].email || '').toLowerCase());
}

// Debug: raw connectivity test
router.get('/ping', async (req, res) => {
  const https = require('https');
  const dns   = require('dns').promises;
  const key   = process.env.STRIPE_SECRET_KEY;
  const keySnippet = key ? key.slice(0, 14) + '...' : 'NOT SET';

  // 1. DNS
  let dnsResult;
  try { dnsResult = await dns.lookup('api.stripe.com'); }
  catch (e) { dnsResult = { error: e.message }; }

  // 2. Raw HTTPS GET (no SDK)
  let rawResult;
  try {
    rawResult = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.stripe.com', port: 443, path: '/v1/balance',
        method: 'GET', timeout: 8000,
        headers: { Authorization: 'Bearer ' + key }
      }, r => { resolve({ status: r.statusCode }); r.resume(); });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    });
  } catch (e) { rawResult = { error: e.message, code: e.code }; }

  res.json({ key: keySnippet, dns: dnsResult, https: rawResult });
});

// Hardcoded Stripe price IDs (Status Stripe account)
const priceIds = {
  standard:        'price_1TGPrtIH8WZvWjkGhexkd3em',
  pro:             'price_1TGPtAIH8WZvWjkGXJmLXfi0',
  standard_yearly: 'price_1TGPsfIH8WZvWjkGja6Wc9kw',
  pro_yearly:      'price_1TGPtXIH8WZvWjkGAKvlppYk',
};

function setupStripeProducts() {
  console.log('Stripe price IDs loaded — standard:', priceIds.standard, '| pro:', priceIds.pro);
}

// Checkout — accepts body: { plan: 'standard' | 'pro', billing: 'monthly' | 'yearly' }
router.post('/checkout', auth, async (req, res) => {
  const plan    = req.body?.plan === 'standard' ? 'standard' : 'pro';
  const billing = req.body?.billing === 'yearly' ? 'yearly' : 'monthly';
  const key     = billing === 'yearly' ? `${plan}_yearly` : plan;
  const priceId = priceIds[key];
  try {
    const { rows: [org] } = await db.query('SELECT * FROM organizations WHERE id = $1', [req.org.id]);
    const { rows: [{ count }] } = await db.query(
      'SELECT COUNT(*) FROM tracked_users WHERE org_id=$1 AND is_active=true AND tracking_enabled=true',
      [req.org.id]
    );
    const quantity = Math.max(1, parseInt(count));
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await getStripe().customers.create({ email: org.email, name: org.name });
      customerId = customer.id;
      await db.query('UPDATE organizations SET stripe_customer_id=$1 WHERE id=$2', [customerId, org.id]);
    }
    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity }],
      success_url:  `${process.env.APP_URL}/dashboard#billing_success`,
      cancel_url:   `${process.env.APP_URL}/dashboard`,
      metadata: { org_id: org.id, plan, billing },
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
});

// Billing portal (manage existing subscription)
router.post('/portal', auth, async (req, res) => {
  try {
    const { rows: [org] } = await db.query('SELECT stripe_customer_id FROM organizations WHERE id=$1', [req.org.id]);
    if (!org.stripe_customer_id) return res.status(400).json({ error: 'No billing account found' });
    const session = await getStripe().billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${process.env.APP_URL}/dashboard`,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to open billing portal' });
  }
});

// Webhook
router.post('/webhook', require('express').raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  const obj = event.data.object;

  if (event.type === 'checkout.session.completed') {
    const orgId = obj.metadata?.org_id;
    const plan  = obj.metadata?.plan || 'pro';
    if (orgId && !(await isFounderOrgById(orgId))) {
      const qty = obj.amount_subtotal > 0 ? (obj.line_items?.data?.[0]?.quantity || 1) : 1;
      await db.query(
        'UPDATE organizations SET subscription_status=$1, stripe_subscription_id=$2, plan=$3, plan_seats=$4 WHERE id=$5',
        ['active', obj.subscription, plan, qty, orgId]
      );
    }
  }

  if (event.type === 'customer.subscription.updated') {
    if (!(await isFounderOrgBySub(obj.id))) {
      const status = obj.status === 'active' ? 'active' : 'past_due';
      const activePriceId = obj.items?.data[0]?.price?.id;
      const plan = (activePriceId === priceIds.standard || activePriceId === priceIds.standard_yearly) ? 'standard'
                 : (activePriceId === priceIds.pro      || activePriceId === priceIds.pro_yearly)      ? 'pro'
                 : null;
      if (plan) {
        await db.query('UPDATE organizations SET subscription_status=$1, plan=$2 WHERE stripe_subscription_id=$3', [status, plan, obj.id]);
      } else {
        await db.query('UPDATE organizations SET subscription_status=$1 WHERE stripe_subscription_id=$2', [status, obj.id]);
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    if (!(await isFounderOrgBySub(obj.id))) {
      await db.query('UPDATE organizations SET subscription_status=$1, plan=$2 WHERE stripe_subscription_id=$3', ['cancelled', 'trial', obj.id]);
    }
  }

  res.json({ received: true });
});

// Add seats to existing subscription (immediate proration charge)
router.post('/seats/add', auth, async (req, res) => {
  const { seats } = req.body;
  if (!seats || seats < 1) return res.status(400).json({ error: 'seats must be >= 1' });
  try {
    const { rows: [org] } = await db.query('SELECT * FROM organizations WHERE id=$1', [req.org.id]);
    if (!org.stripe_subscription_id) return res.status(400).json({ error: 'No active subscription' });
    const subscription = await getStripe().subscriptions.retrieve(org.stripe_subscription_id);
    const item = subscription.items.data[0];
    const newQty = (item.quantity || 1) + parseInt(seats);
    await getStripe().subscriptions.update(org.stripe_subscription_id, {
      items: [{ id: item.id, quantity: newQty }],
      proration_behavior: 'always_invoice',
    });
    await db.query('UPDATE organizations SET plan_seats=$1 WHERE id=$2', [newQty, org.id]);
    res.json({ plan_seats: newQty });
  } catch (err) {
    console.error('Add seats error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, setupStripeProducts };
