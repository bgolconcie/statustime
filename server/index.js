require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { migrate } = require('./db');
const { startPoller } = require('./jobs/poller');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.APP_URL || '*', credentials: true }));

// Stripe webhook needs raw body
app.use('/api/billing/webhook', require('./routes/billing'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/slack', require('./routes/slack').router);
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/billing', require('./routes/billing'));

// Static assets (JS/CSS chunks from Vite build)
app.use(express.static(path.join(__dirname, '../public')));

// Marketing landing page at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/marketing.html'));
});

// React SPA for all app routes
const spaRoutes = ['/dashboard', '/user', '/login'];
spaRoutes.forEach(route => {
  app.get(route + '*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/app.html'));
  });
});

// Fallback: also serve SPA for any unmatched routes that aren't API or assets
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, '../public/app.html'));
});

async function start() {
  try {
    await migrate();
    app.listen(PORT, () => {
      console.log('StatusTime running on port ' + PORT);
      startPoller();
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();
