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
    const { access_token, team, bot_user_id } = data;
    await db.query(
      `INSERT INTO integrations (org_id,platform,access_token,team_id,team_name,bot_user_id)
       VALUES ($1,'slack',$2,$3,$4,$5) ON CONFLICT (org_id,platform,team_id) DO UPDATE SET access_token=$2`,
      [orgId, access_token, team.id, team.name, bot_user_id]
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
  do {
    const result = await client.users.list({ limit: 200, cursor });
    for (const member of result.members) {
      if (member.is_bot || member.deleted || member.id === 'USLACKBOT') continue;
      await db.query(
        `INSERT INTO tracked_users (org_id,integration_id,platform_user_id,display_name,email,avatar_url)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (org_id,platform_user_id) DO UPDATE SET display_name=$4,avatar_url=$6`,
        [orgId, integrationId, member.id, member.real_name||member.name, member.profile?.email, member.profile?.image_72]
      );
    }
    cursor = result.response_metadata?.next_cursor;
  } while (cursor);
}

module.exports = { router, syncSlackUsers };
