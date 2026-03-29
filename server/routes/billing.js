const router = require('express').Router();
const Stripe = require('stripe');
const db = require('../db');
const auth = require('../middleware/auth');

// Lazily initialized — reads key at request time, not at module load
let _stripe = null;
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
  return _stripe;
}

// Debug: test Stripe connectivity (no auth required)
router.get('/ping', async (req, res) => {
  const keySnippet = process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.slice(0, 12) + '...' : 'NOT SET';
  try {
    const bal = await getStripe().balance.retrieve();
    res.json({ ok: true, key: keySnippet, livemode: bal.livemode });
  } catch (err) {
    res.json({ ok: false, key: keySnippet, error: err.message, type: err.type || err.constructor?.name });
  }
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
    const { rows: [{ count }] } = await db.query('SELECT COUNT(*) FROM tracked_users WHERE org_id=$1 AND is_active=true', [req.org.id]);
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
    if (orgId) {
      await db.query(
        'UPDATE organizations SET subscription_status=$1, stripe_subscription_id=$2, plan=$3 WHERE id=$4',
        ['active', obj.subscription, plan, orgId]
      );
    }
  }

  if (event.type === 'customer.subscription.updated') {
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

  if (event.type === 'customer.subscription.deleted') {
    await db.query('UPDATE organizations SET subscription_status=$1, plan=$2 WHERE stripe_subscription_id=$3', ['cancelled', 'trial', obj.id]);
  }

  res.json({ received: true });
});

module.exports = { router, setupStripeProducts };
