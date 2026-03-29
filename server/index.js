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
const PUBLIC = path.join(__dirname, '../public');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.APP_URL || '*', credentials: true }));
app.use('/api/billing/webhook', require('./routes/billing'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/slack', require('./routes/slack').router);
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/billing', require('./routes/billing'));

// Serve static assets (Vite build: JS/CSS chunks)
app.use(express.static(PUBLIC));

// Marketing landing page at exactly /
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC, 'marketing.html'));
});

// React SPA for all app routes - served from Vite's index.html
app.get(['/dashboard', '/dashboard/*', '/user/:id', '/login'], (req, res) => {
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

// Fallback for any other non-API route -> React SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(PUBLIC, 'index.html'));
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
