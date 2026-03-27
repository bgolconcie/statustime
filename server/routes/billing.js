const router = require('express').Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db');
const auth = require('../middleware/auth');

router.post('/checkout', auth, async (req, res) => {
  try {
    const orgResult = await db.query('SELECT * FROM organizations WHERE id = $1', [req.org.id]);
    const org = orgResult.rows[0];
    const usersResult = await db.query('SELECT COUNT(*) FROM tracked_users WHERE org_id = $1 AND is_active = true', [req.org.id]);
    const quantity = Math.max(1, parseInt(usersResult.rows[0].count));
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: org.email, name: org.name });
      customerId = customer.id;
      await db.query('UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2', [customerId, org.id]);
    }
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity }],
      success_url: `${process.env.APP_URL}/dashboard#billing_success`,
      cancel_url: `${process.env.APP_URL}/dashboard#billing_cancelled`,
      metadata: { org_id: org.id },
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

router.post('/portal', auth, async (req, res) => {
  try {
    const orgResult = await db.query('SELECT stripe_customer_id FROM organizations WHERE id = $1', [req.org.id]);
    const { stripe_customer_id } = orgResult.rows[0];
    if (!stripe_customer_id) return res.status(400).json({ error: 'No billing account found' });
    const session = await stripe.billingPortal.sessions.create({
      customer: stripe_customer_id,
      return_url: `${process.env.APP_URL}/dashboard`,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to open billing portal' });
  }
});

router.post('/webhook', require('express').raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  const obj = event.data.object;
  if (event.type === 'checkout.session.completed') {
    const orgId = obj.metadata?.org_id;
    if (orgId) await db.query('UPDATE organizations SET subscription_status=$1, stripe_subscription_id=$2 WHERE id=$3', ['active', obj.subscription, orgId]);
  }
  if (event.type === 'customer.subscription.deleted') {
    await db.query('UPDATE organizations SET subscription_status=$1 WHERE stripe_subscription_id=$2', ['cancelled', obj.id]);
  }
  if (event.type === 'customer.subscription.updated') {
    const status = obj.status === 'active' ? 'active' : 'past_due';
    await db.query('UPDATE organizations SET subscription_status=$1 WHERE stripe_subscription_id=$2', [status, obj.id]);
  }
  res.json({ received: true });
});

module.exports = router;
