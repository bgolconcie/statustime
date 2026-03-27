const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO organizations (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, subscription_status, trial_ends_at',
      [name, email, hash]
    );
    const org = result.rows[0];
    const token = jwt.sign({ id: org.id, email: org.email, name: org.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, org });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already registered' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const result = await db.query('SELECT * FROM organizations WHERE email = $1', [email]);
    const org = result.rows[0];
    if (!org) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, org.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: org.id, email: org.email, name: org.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, org: { id: org.id, name: org.name, email: org.email, subscription_status: org.subscription_status, trial_ends_at: org.trial_ends_at } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email, subscription_status, trial_ends_at, stripe_subscription_id FROM organizations WHERE id = $1', [req.org.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
