const cron = require('node-cron');
const { WebClient } = require('@slack/web-api');
const db = require('../db');

const activeSessions = new Map();

async function pollSlackStatuses() {
  try {
    const ir = await db.query(`SELECT i.*,o.id as org_id FROM integrations i
      JOIN organizations o ON i.org_id=o.id WHERE i.platform='slack'
      AND (o.subscription_status='active' OR o.trial_ends_at>NOW())`);
    for (const integration of ir.rows) {
      try {
        const client = new WebClient(integration.access_token);
        const ur = await db.query('SELECT * FROM tracked_users WHERE org_id=$1 AND integration_id=$2 AND is_active=true',
          [integration.org_id, integration.id]);
        for (const user of ur.rows) {
          try {
            const presence = await client.users.getPresence({ user: user.platform_user_id });
            const isActive = presence.presence === 'active';
            const key = user.id;
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            if (isActive) {
              if (!activeSessions.has(key)) activeSessions.set(key, { startedAt: now, date: today, orgId: integration.org_id });
            } else {
              if (activeSessions.has(key)) {
                const session = activeSessions.get(key);
                const mins = Math.round((now - session.startedAt) / 60000);
                if (mins >= 1) {
                  await db.query(`INSERT INTO time_sessions (user_id,org_id,started_at,ended_at,duration_minutes,date)
                    VALUES ($1,$2,$3,$4,$5,$6)`,
                    [user.id, session.orgId, session.startedAt, now, mins, session.date, 'active']);
                }
                activeSessions.delete(key);
              }
            }
          } catch (userErr) {
            if (userErr.code !== 'ratelimited') console.error(`Poll user ${user.display_name}:`, userErr.message);
          }
          await new Promise(r => setTimeout(r, 1100));
        }
      } catch (err) { console.error('Integration error:', err.message); }
    }
  } catch (err) { console.error('Poll error:', err.message); }
}

async function flushActiveSessions() {
  const now = new Date();
  for (const [key, session] of activeSessions.entries()) {
    const mins = Math.round((now - session.startedAt) / 60000);
    if (mins >= 1) {
      try {
        await db.query(`INSERT INTO time_sessions (user_id,org_id,started_at,ended_at,duration_minutes,date)
          VALUES ($1,$2,$3,$4,$5,$6)`,
          [key, session.orgId, session.startedAt, now, mins, session.date, 'active']);
      } catch (err) { console.error('Flush error:', err.message); }
    }
  }
  activeSessions.clear();
}

function startPoller() {
  console.log('Status poller started - polling every 5 minutes');
  cron.schedule('*/5 * * * *', () => {
    console.log(`[${new Date().toISOString()}] Polling Slack statuses...`);
    pollSlackStatuses();
  });
  cron.schedule('59 23 * * *', () => {
    console.log('Flushing end-of-day sessions...');
    flushActiveSessions();
  });
  setTimeout(pollSlackStatuses, 5000);
}

module.exports = { startPoller, pollSlackStatuses };
