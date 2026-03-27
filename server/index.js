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

// Stripe webhook needs raw body - must come BEFORE express.json()
app.use('/api/billing/webhook', require('./routes/billing'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/slack', require('./routes/slack').router);
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/billing', require('./routes/billing'));

app.use(express.static(path.join(__dirname, '../public')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

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
