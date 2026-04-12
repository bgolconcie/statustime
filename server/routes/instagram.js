const router = require('express').Router();
const fetch = require('node-fetch');
const db = require('../db');
const auth = require('../middleware/auth');

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const APP_URL = process.env.APP_URL;
const REDIRECT_URI = `${APP_URL}/api/instagram/callback`;

// Step 1 — redirect to Meta OAuth
router.get('/install', auth, (req, res) => {
  const scopes = 'instagram_basic,instagram_manage_comments,pages_show_list';
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scopes}&response_type=code&state=${req.org.id}`;
  res.json({ url });
});

// Step 2 — OAuth callback: exchange code → tokens → store
router.get('/callback', async (req, res) => {
  const { code, state: orgId } = req.query;
  if (!code || !orgId) return res.redirect('/#error=instagram_auth_failed');

  try {
    // Exchange code for short-lived user token
    const tokenRes = await fetch('https://graph.facebook.com/v19.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: META_APP_ID, client_secret: META_APP_SECRET, redirect_uri: REDIRECT_URI, code }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error.message);

    // Exchange for long-lived token (60 days)
    const longRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
    );
    const longData = await longRes.json();
    if (longData.error) throw new Error(longData.error.message);
    const longLivedToken = longData.access_token;

    // Get FB pages the user manages
    const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedToken}`);
    const pagesData = await pagesRes.json();
    if (!pagesData.data?.length) throw new Error('No Facebook Pages found for this account');

    // For each page, get linked IG Business account
    let igUserId = null;
    let igUsername = null;
    let pageId = null;
    let pageName = null;

    for (const page of pagesData.data) {
      const igRes = await fetch(
        `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      );
      const igData = await igRes.json();
      if (igData.instagram_business_account?.id) {
        igUserId = igData.instagram_business_account.id;
        pageId = page.id;
        pageName = page.name;

        // Get IG username
        const profileRes = await fetch(
          `https://graph.facebook.com/v19.0/${igUserId}?fields=username&access_token=${longLivedToken}`
        );
        const profileData = await profileRes.json();
        igUsername = profileData.username || pageName;
        break;
      }
    }

    if (!igUserId) throw new Error('No Instagram Business account linked to your Facebook Pages');

    // Store in integrations table — reuse same table, platform = 'instagram'
    await db.query(
      `INSERT INTO integrations (org_id, platform, access_token, team_id, team_name)
       VALUES ($1, 'instagram', $2, $3, $4)
       ON CONFLICT (org_id, platform, team_id) DO UPDATE SET access_token=$2, team_name=$4`,
      [orgId, longLivedToken, igUserId, igUsername]
    );

    res.redirect('/dashboard#instagram_connected');
  } catch (err) {
    console.error('Instagram OAuth error:', err);
    res.redirect('/dashboard#error=instagram_auth_failed');
  }
});

// GET /api/instagram/posts — fetch recent posts with comments
router.get('/posts', auth, async (req, res) => {
  try {
    const ig = await db.query(
      `SELECT access_token, team_id as ig_user_id, team_name as username
       FROM integrations WHERE org_id=$1 AND platform='instagram' LIMIT 1`,
      [req.org.id]
    );
    if (!ig.rows.length) return res.status(404).json({ error: 'No Instagram integration' });
    const { access_token, ig_user_id, username } = ig.rows[0];

    const limit = req.query.limit || 10;

    const mediaRes = await fetch(
      `https://graph.facebook.com/v19.0/${ig_user_id}/media` +
      `?fields=id,caption,media_url,thumbnail_url,media_type,timestamp,permalink,like_count,comments_count,` +
      `comments{id,text,username,timestamp,replies{id,text,username,timestamp}}` +
      `&limit=${limit}&access_token=${access_token}`
    );
    const mediaData = await mediaRes.json();
    if (mediaData.error) throw new Error(mediaData.error.message);

    res.json({ username, posts: mediaData.data || [] });
  } catch (err) {
    console.error('Instagram posts error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/instagram/comments/:commentId/reply — reply to a comment
router.post('/comments/:commentId/reply', auth, async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  try {
    const ig = await db.query(
      `SELECT access_token FROM integrations WHERE org_id=$1 AND platform='instagram' LIMIT 1`,
      [req.org.id]
    );
    if (!ig.rows.length) return res.status(404).json({ error: 'No Instagram integration' });
    const { access_token } = ig.rows[0];

    const replyRes = await fetch(
      `https://graph.facebook.com/v19.0/${req.params.commentId}/replies`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ message, access_token }),
      }
    );
    const replyData = await replyRes.json();
    if (replyData.error) throw new Error(replyData.error.message);

    res.json({ success: true, reply_id: replyData.id });
  } catch (err) {
    console.error('Instagram reply error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/instagram/comments/:commentId — hide a comment
router.delete('/comments/:commentId', auth, async (req, res) => {
  try {
    const ig = await db.query(
      `SELECT access_token FROM integrations WHERE org_id=$1 AND platform='instagram' LIMIT 1`,
      [req.org.id]
    );
    if (!ig.rows.length) return res.status(404).json({ error: 'No Instagram integration' });
    const { access_token } = ig.rows[0];

    const hideRes = await fetch(
      `https://graph.facebook.com/v19.0/${req.params.commentId}?hidden=true&access_token=${access_token}`,
      { method: 'POST' }
    );
    const hideData = await hideRes.json();
    if (hideData.error) throw new Error(hideData.error.message);

    res.json({ success: true });
  } catch (err) {
    console.error('Instagram hide comment error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
