const router = require('express').Router();
const { WebClient } = require('@slack/web-api');
const fetch = require('node-fetch');
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/install', auth, (req, res) => {
  const scopes = 'users:read,users:read.email,users.profile:read';
  const url = `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${process.env.APP_URL}/api/slack/callback&state=${req.org.id}`;
  res.json({ url });
});

router.get('/callback', async (req, res) => {
  const { code, state: orgId } = req.query;
  if (!code || !orgId) return res.redirect('/#error=slack_auth_failed');
  try {
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.APP_URL}/api/slack/callback`,
      }),
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error);
    const { access_token, team } = data;
    await db.query(
      `INSERT INTO integrations (org_id,platform,access_token,team_id,team_name)
       VALUES ($1,'slack',$2,$3,$4) ON CONFLICT (org_id,platform,team_id) DO UPDATE SET access_token=$2`,
      [orgId, access_token, team.id, team.name]
    );
    const ir = await db.query('SELECT id FROM integrations WHERE org_id=$1 AND team_id=$2', [orgId, team.id]);
    await syncSlackUsers(orgId, ir.rows[0].id, access_token);
    res.redirect('/dashboard#slack_connected');
  } catch (err) {
    console.error('Slack OAuth error:', err);
    res.redirect('/dashboard#error=slack_auth_failed');
  }
});

async function syncSlackUsers(orgId, integrationId, token) {
  const client = new WebClient(token);
  let cursor;
  const synced = [];
  do {
    const result = await client.users.list({ limit: 200, cursor });
    for (const member of result.members) {
      if (member.is_bot || member.id === 'USLACKBOT') continue;
      if (member.deleted) {
        await db.query('UPDATE tracked_users SET is_active=false WHERE org_id=$1 AND platform_user_id=$2', [orgId, member.id]);
        continue;
      }
      const isGuest = member.is_restricted === true || member.is_ultra_restricted === true;
      const userType = isGuest ? 'external' : 'member';
      const timezone = member.tz || 'UTC';
      await db.query(
        `INSERT INTO tracked_users (org_id,integration_id,platform_user_id,display_name,email,avatar_url,user_type,timezone,is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
         ON CONFLICT (org_id,platform_user_id) DO UPDATE
           SET display_name=$4, avatar_url=$6, user_type=$7, timezone=$8, is_active=true`,
        [orgId, integrationId, member.id, member.real_name||member.name, member.profile?.email, member.profile?.image_72, userType, timezone]
      );
      synced.push({ id: member.id, name: member.real_name, userType, timezone });
    }
    cursor = result.response_metadata?.next_cursor;
  } while (cursor);
  console.log('[Slack sync] synced', synced.length, 'users:', JSON.stringify(synced.reduce((a,u) => { a[u.userType]=(a[u.userType]||0)+1; return a; }, {})));
  return synced;
}

router.post('/sync', auth, async (req, res) => {
  try {
    const integrations = await db.query('SELECT id,access_token FROM integrations WHERE org_id=$1 AND platform=$2', [req.org.id,'slack']);
    if (!integrations.rows.length) return res.status(404).json({ error: 'No Slack integration' });
    let total = [];
    for (const { id, access_token } of integrations.rows) {
      const r = await syncSlackUsers(req.org.id, id, access_token);
      total = total.concat(r);
    }
    const breakdown = total.reduce((a,u) => { a[u.userType]=(a[u.userType]||0)+1; return a; }, {});
    res.json({ success: true, synced: total.length, breakdown });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/debug-members', auth, async (req, res) => {
  try {
    const integrations = await db.query('SELECT access_token FROM integrations WHERE org_id=$1 AND platform=$2 LIMIT 1', [req.org.id,'slack']);
    if (!integrations.rows.length) return res.status(404).json({ error: 'No integration' });
    const client = new WebClient(integrations.rows[0].access_token);
    const result = await client.users.list({ limit: 200 });
    const members = result.members.filter(m => !m.is_bot && m.id !== 'USLACKBOT').map(m => ({
      id: m.id, name: m.real_name||m.name, deleted: m.deleted,
      is_restricted: m.is_restricted, is_ultra_restricted: m.is_ultra_restricted,
      tz: m.tz, classified_as: m.deleted ? 'DEACTIVATED' : (m.is_restricted||m.is_ultra_restricted ? 'external' : 'member')
    }));
    res.json(members);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = { router, syncSlackUsers };
