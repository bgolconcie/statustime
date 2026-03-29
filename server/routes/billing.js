const router = require('express').Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db');
const auth = require('../middleware/auth');

// Price IDs resolved at startup via setupStripeProducts()
const priceIds = { standard: null, pro: null, standard_yearly: null, pro_yearly: null };

const PLANS = {
  standard:        { name: 'Status Standard', amount: 600,  interval: 'month' },
  pro:             { name: 'Status Pro',       amount: 900,  interval: 'month' },
  standard_yearly: { name: 'Status Standard', amount: 6000, interval: 'year'  },
  pro_yearly:      { name: 'Status Pro',       amount: 9000, interval: 'year'  },
};

async function setupStripeProducts() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('STRIPE_SECRET_KEY not set — billing disabled');
    return;
  }
  try {
    const { data: products } = await stripe.products.list({ limit: 100, active: true });
    // Build product map by name (each product shared by monthly + yearly prices)
    const productMap = {};
    for (const p of products) productMap[p.name] = p;

    for (const [key, plan] of Object.entries(PLANS)) {
      if (!productMap[plan.name]) {
        productMap[plan.name] = await stripe.products.create({ name: plan.name });
        console.log(`Stripe: created product "${plan.name}"`);
      }
      const product = productMap[plan.name];
      const { data: prices } = await stripe.prices.list({ product: product.id, active: true, limit: 20 });
      let price = prices.find(p => p.unit_amount === plan.amount && p.currency === 'usd' && p.recurring?.interval === plan.interval);
      if (!price) {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.amount,
          currency: 'usd',
          recurring: { interval: plan.interval },
        });
        console.log(`Stripe: created ${plan.interval}ly price for "${plan.name}" → ${price.id}`);
      }
      priceIds[key] = price.id;
    }
    console.log('Stripe products ready — standard:', priceIds.standard, '| pro:', priceIds.pro);
  } catch (err) {
    console.error('Stripe setup error:', err.message);
  }
}

// Checkout — accepts body: { plan: 'standard' | 'pro', billing: 'monthly' | 'yearly' }
router.post('/checkout', auth, async (req, res) => {
  const plan    = req.body?.plan === 'standard' ? 'standard' : 'pro';
  const billing = req.body?.billing === 'yearly' ? 'yearly' : 'monthly';
  const key     = billing === 'yearly' ? `${plan}_yearly` : plan;
  let priceId = priceIds[key];
  if (!priceId) {
    await setupStripeProducts();
    priceId = priceIds[key];
  }
  if (!priceId) return res.status(503).json({ error: 'Billing not configured — check STRIPE_SECRET_KEY in Railway' });
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
    res.status(500).json({ error: 'Failed to create checkout session' });
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
    const plan = activePriceId === priceIds.standard ? 'standard'
               : activePriceId === priceIds.pro      ? 'pro'
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
