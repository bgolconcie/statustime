const router = require('express').Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db');
const auth = require('../middleware/auth');

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
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'STRIPE_SECRET_KEY not set in Railway' });
  try {
    const { rows: [org] } = await db.query('SELECT * FROM organizations WHERE id = $1', [req.org.id]);
    const { rows: [{ count }] } = await db.query('SELECT COUNT(*) FROM tracked_users WHERE org_id=$1 AND is_active=true', [req.org.id]);
    const quantity = Math.max(1, parseInt(count));
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: org.email, name: org.name });
      customerId = customer.id;
      await db.query('UPDATE organizations SET stripe_customer_id=$1 WHERE id=$2', [customerId, org.id]);
    }
    const session = await stripe.checkout.sessions.create({
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
    const session = await stripe.billingPortal.sessions.create({
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
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
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
