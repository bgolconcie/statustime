const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { WebClient } = require('@slack/web-api');

// All tracked users with today/week hours + timezone
router.get('/users', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT tu.id, tu.platform_user_id, tu.display_name, tu.email, tu.avatar_url, tu.user_type, tu.timezone,
        i.platform, i.team_name,
        COALESCE(today.minutes,0) as today_minutes,
        COALESCE(week.minutes,0) as week_minutes
       FROM tracked_users tu
       JOIN integrations i ON tu.integration_id = i.id
       LEFT JOIN (SELECT user_id, SUM(duration_minutes) as minutes FROM time_sessions WHERE date=CURRENT_DATE GROUP BY user_id) today ON tu.id=today.user_id
       LEFT JOIN (SELECT user_id, SUM(duration_minutes) as minutes FROM time_sessions WHERE date>=CURRENT_DATE-6 GROUP BY user_id) week ON tu.id=week.user_id
       WHERE tu.org_id=$1 AND tu.is_active=true ORDER BY tu.display_name`,
      [req.org.id]
    );
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/users/:userId', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT tu.*, i.platform, i.team_name FROM tracked_users tu JOIN integrations i ON tu.integration_id=i.id WHERE tu.id=$1 AND tu.org_id=$2`,
      [req.params.userId, req.org.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/users/:userId/hours', auth, async (req, res) => {
  const { days = 30 } = req.query;
  try {
    const result = await db.query(
      `SELECT date, SUM(duration_minutes) as total_minutes
       FROM time_sessions
       WHERE user_id=$1 AND org_id=$2 AND date >= CURRENT_DATE - ($3::int - 1) AND duration_minutes IS NOT NULL
       GROUP BY date ORDER BY date ASC`,
      [req.params.userId, req.org.id, parseInt(days)]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Hourly heatmap: for each (date, hour) pair return active minutes within that hour
// Uses actual start_time/end_time timestamps to split session time across hours
router.get('/users/:userId/heatmap', auth, async (req, res) => {
  const { days = 14 } = req.query;
  try {
    const result = await db.query(
      `SELECT date, start_time, end_time, duration_minutes
       FROM time_sessions
       WHERE user_id=$1 AND org_id=$2
         AND date >= CURRENT_DATE - ($3::int - 1)
         AND start_time IS NOT NULL AND end_time IS NOT NULL
         AND duration_minutes > 0
       ORDER BY date, start_time`,
      [req.params.userId, req.org.id, parseInt(days)]
    );

    // Build map: { "2026-03-27": { 9: 42, 10: 60, 11: 18 }, ... }
    const heatmap = {};

    for (const row of result.rows) {
      const start = new Date(row.start_time);
      const end = new Date(row.end_time);
      const dateStr = row.date instanceof Date
        ? row.date.toISOString().split('T')[0]
        : String(row.date).split('T')[0];

      if (!heatmap[dateStr]) heatmap[dateStr] = {};

      // Walk through each minute of the session, bucketing into hours
      let cur = new Date(start);
      while (cur < end) {
        const h = cur.getUTCHours();
        const nextHourBoundary = new Date(cur);
        nextHourBoundary.setUTCMinutes(60, 0, 0);
        const sliceEnd = nextHourBoundary < end ? nextHourBoundary : end;
        const mins = (sliceEnd - cur) / 60000;
        heatmap[dateStr][h] = (heatmap[dateStr][h] || 0) + mins;
        cur = sliceEnd;
      }
    }

    // Flatten to array: [{ date, hour, minutes, pct }]
    const flat = [];
    for (const [date, hours] of Object.entries(heatmap)) {
      for (const [hour, minutes] of Object.entries(hours)) {
        flat.push({
          date,
          hour: parseInt(hour),
          minutes: Math.round(minutes * 10) / 10,
          pct: Math.min(100, Math.round((minutes / 60) * 100))
        });
      }
    }
    flat.sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);
    res.json(flat);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/users/:userId/sessions', auth, async (req, res) => {
  const { days = 14 } = req.query;
  try {
    const result = await db.query(
      `SELECT date, start_time, end_time, duration_minutes, status
       FROM time_sessions
       WHERE user_id=$1 AND org_id=$2 AND date >= CURRENT_DATE - ($3::int - 1)
       ORDER BY start_time DESC NULLS LAST, date DESC LIMIT 500`,
      [req.params.userId, req.org.id, parseInt(days)]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/users/:userId/stats', auth, async (req, res) => {
  const { days = 30 } = req.query;
  try {
    const hoursRes = await db.query(
      `SELECT date, SUM(duration_minutes) as total_minutes FROM time_sessions
       WHERE user_id=$1 AND org_id=$2 AND date >= CURRENT_DATE - ($3::int - 1) AND duration_minutes IS NOT NULL
       GROUP BY date ORDER BY date`,
      [req.params.userId, req.org.id, parseInt(days)]
    );
    const rows = hoursRes.rows;
    const totalMins = rows.reduce((s, r) => s + parseInt(r.total_minutes), 0);
    const activeDays = rows.filter(r => r.total_minutes > 0).length;
    const maxRow = rows.reduce((m, r) => (!m || r.total_minutes > m.total_minutes ? r : m), null);
    const avgPerActiveDay = activeDays > 0 ? Math.round(totalMins / activeDays) : 0;
    res.json({ totalMinutes: totalMins, activeDays, avgPerActiveDay,
      mostActiveDay: maxRow ? { date: maxRow.date, minutes: parseInt(maxRow.total_minutes) } : null,
      daysRange: parseInt(days) });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/presence', auth, async (req, res) => {
  try {
    const integrations = await db.query(
      `SELECT i.access_token, i.platform, tu.id as user_id, tu.platform_user_id
       FROM integrations i JOIN tracked_users tu ON tu.integration_id=i.id
       WHERE i.org_id=$1 AND tu.is_active=true`, [req.org.id]
    );
    const presenceMap = {};
    const byToken = {};
    for (const row of integrations.rows) {
      if (!byToken[row.access_token]) byToken[row.access_token] = { token: row.access_token, platform: row.platform, users: [] };
      byToken[row.access_token].users.push({ userId: row.user_id, platformUserId: row.platform_user_id });
    }
    for (const { token, platform, users } of Object.values(byToken)) {
      if (platform === 'slack') {
        const client = new WebClient(token);
        for (const { userId, platformUserId } of users) {
          try {
            const p = await client.users.getPresence({ user: platformUserId });
            presenceMap[userId] = p.presence === 'active' ? 'active' : 'away';
          } catch { presenceMap[userId] = 'unknown'; }
          await new Promise(r => setTimeout(r, 200));
        }
      }
    }
    res.json(presenceMap);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/users/:userId/presence', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT i.access_token, i.platform, tu.platform_user_id
       FROM tracked_users tu JOIN integrations i ON tu.integration_id=i.id
       WHERE tu.id=$1 AND tu.org_id=$2`,
      [req.params.userId, req.org.id]
    );
    if (!result.rows.length) return res.json({ status: 'unknown' });
    const { access_token, platform, platform_user_id } = result.rows[0];
    if (platform === 'slack') {
      const client = new WebClient(access_token);
      const p = await client.users.getPresence({ user: platform_user_id });
      return res.json({ status: p.presence === 'active' ? 'active' : 'away' });
    }
    res.json({ status: 'unknown' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/hours', auth, async (req, res) => {
  const { days=7, userId } = req.query;
  try {
    let q = `SELECT tu.id,tu.display_name,tu.avatar_url,ts.date,SUM(ts.duration_minutes) as total_minutes
              FROM time_sessions ts JOIN tracked_users tu ON ts.user_id=tu.id
              WHERE ts.org_id=$1 AND ts.date>=CURRENT_DATE-$2 AND ts.duration_minutes IS NOT NULL`;
    const params = [req.org.id, parseInt(days)-1];
    if (userId) { q += ` AND ts.user_id=$3`; params.push(userId); }
    q += ` GROUP BY tu.id,tu.display_name,tu.avatar_url,ts.date ORDER BY ts.date DESC,tu.display_name`;
    const result = await db.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/integrations', auth, async (req, res) => {
  try {
    const result = await db.query('SELECT id,platform,team_name,team_id,created_at FROM integrations WHERE org_id=$1', [req.org.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/stats', auth, async (req, res) => {
  try {
    const [u,t,w] = await Promise.all([
      db.query('SELECT COUNT(*) FROM tracked_users WHERE org_id=$1 AND is_active=true',[req.org.id]),
      db.query('SELECT COALESCE(SUM(duration_minutes),0) as total FROM time_sessions WHERE org_id=$1 AND date=CURRENT_DATE',[req.org.id]),
      db.query('SELECT COALESCE(SUM(duration_minutes),0) as total FROM time_sessions WHERE org_id=$1 AND date>=CURRENT_DATE-6',[req.org.id]),
    ]);
    res.json({ totalUsers:parseInt(u.rows[0].count), todayMinutes:parseInt(t.rows[0].total), weekMinutes:parseInt(w.rows[0].total) });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/export', auth, async (req, res) => {
  const { from, to } = req.query;
  try {
    const result = await db.query(
      `SELECT tu.display_name,tu.email,i.platform,i.team_name,ts.date,
        SUM(ts.duration_minutes) as total_minutes,
        ROUND(SUM(ts.duration_minutes)::numeric/60,2) as total_hours
       FROM time_sessions ts JOIN tracked_users tu ON ts.user_id=tu.id JOIN integrations i ON tu.integration_id=i.id
       WHERE ts.org_id=$1 AND ts.date>=$2 AND ts.date<=$3
       GROUP BY tu.display_name,tu.email,i.platform,i.team_name,ts.date
       ORDER BY ts.date DESC,tu.display_name`,
      [req.org.id, from||'2024-01-01', to||new Date().toISOString().split('T')[0]]
    );
    const csv = ['Name,Email,Platform,Team,Date,Minutes,Hours',
      ...result.rows.map(r => `"${r.display_name}","${r.email||''}","${r.platform}","${r.team_name}","${r.date}",${r.total_minutes},${r.total_hours}`)
    ].join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition',`attachment; filename=statustime-export-${Date.now()}.csv`);
    res.send(csv);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/leave', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT lr.*,tu.display_name,tu.avatar_url FROM leave_requests lr
       JOIN tracked_users tu ON lr.user_id=tu.id WHERE lr.org_id=$1 ORDER BY lr.created_at DESC LIMIT 50`,
      [req.org.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.patch('/leave/:id', auth, async (req, res) => {
  try {
    await db.query('UPDATE leave_requests SET status=$1 WHERE id=$2 AND org_id=$3', [req.body.status, req.params.id, req.org.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});


// Hourly heatmap: active_minutes per (date, hour) slot
router.get('/users/:userId/heatmap', auth, async (req, res) => {
  const { days = 14 } = req.query;
  try {
    const result = await db.query(
      `SELECT
          date::text,
          h.hour,
          SUM(
            GREATEST(0, EXTRACT(EPOCH FROM (
              LEAST(end_time AT TIME ZONE 'UTC', (date::timestamp + ((h.hour + 1) || ' hours')::interval))
              - GREATEST(start_time AT TIME ZONE 'UTC', (date::timestamp + (h.hour || ' hours')::interval))
            )) / 60)
          )::int AS active_minutes
        FROM time_sessions
        CROSS JOIN generate_series(0, 23) AS h(hour)
        WHERE user_id = $1
          AND org_id = $2
          AND date >= CURRENT_DATE - ($3::int - 1)
          AND start_time IS NOT NULL
          AND end_time IS NOT NULL
          AND end_time > start_time
          AND start_time AT TIME ZONE 'UTC' < (date::timestamp + ((h.hour + 1) || ' hours')::interval)
          AND end_time   AT TIME ZONE 'UTC' > (date::timestamp + (h.hour || ' hours')::interval)
        GROUP BY date, h.hour
        ORDER BY date ASC, h.hour ASC`,
      [req.params.userId, req.org.id, parseInt(days)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('heatmap error', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// Hourly heatmap - % active per hour slot across all sessions in range
router.get('/users/:userId/hourly', auth, async (req, res) => {
  const { days = 30 } = req.query;
  const daysInt = parseInt(days);
  try {
    const result = await db.query(
      `SELECT start_time, end_time FROM time_sessions
       WHERE user_id=$1 AND org_id=$2
         AND date >= CURRENT_DATE - ($3::int - 1)
         AND start_time IS NOT NULL AND end_time IS NOT NULL
         AND duration_minutes > 0`,
      [req.params.userId, req.org.id, daysInt]
    );
    const activeMinutes = new Array(24).fill(0);
    for (const row of result.rows) {
      const start = new Date(row.start_time);
      const end = new Date(row.end_time);
      let cur = new Date(start);
      while (cur < end) {
        const h = cur.getUTCHours();
        const nextHour = new Date(Date.UTC(cur.getUTCFullYear(),cur.getUTCMonth(),cur.getUTCDate(),h+1,0,0,0));
        const sliceEnd = nextHour < end ? nextHour : end;
        activeMinutes[h] += (sliceEnd - cur) / 60000;
        cur = nextHour;
      }
    }
    const maxPossible = daysInt * 60;
    const heatmap = activeMinutes.map((mins, hour) => ({
      hour,
      pct: Math.min(100, Math.round((mins / maxPossible) * 1000) / 10)
    }));
    res.json(heatmap);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;