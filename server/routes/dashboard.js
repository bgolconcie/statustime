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
  const { days = 30, tz = 'UTC' } = req.query;
  const safeTz = tz.replace(/[^A-Za-z0-9/_+-]/g, '') || 'UTC';
  try {
    const result = await db.query(
      `SELECT
         (polled_at AT TIME ZONE $4)::date AS date,
         COUNT(*) FILTER (WHERE is_active = true) * 5 AS total_minutes
       FROM presence_snapshots
       WHERE user_id = $1 AND org_id = $2
         AND polled_at >= NOW() - ($3::int * INTERVAL '1 day')
       GROUP BY date
       ORDER BY date ASC`,
      [req.params.userId, req.org.id, parseInt(days), safeTz]
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


// Hourly heatmap — 7 rows (day of week) x 24 cols (hour)
// Returns [{dow:0-6, hour:0-23, active:N, total:N, pct:0-100}]
router.get('/users/:userId/hourly', auth, async (req, res) => {
  const { days = 30, tz = 'UTC' } = req.query;
  const daysInt = parseInt(days);
  const safeTz = tz.replace(/[^A-Za-z0-9/_+-]/g, '') || 'UTC';
  try {
    const result = await db.query(
      `SELECT
         EXTRACT(DOW FROM polled_at AT TIME ZONE $4)::int AS dow,
         EXTRACT(HOUR FROM polled_at AT TIME ZONE $4)::int AS hour,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE is_active = true) AS active
       FROM presence_snapshots
       WHERE user_id = $1
         AND org_id = $2
         AND polled_at >= NOW() - ($3::int * INTERVAL '1 day')
       GROUP BY dow, hour
       ORDER BY dow, hour`,
      [req.params.userId, req.org.id, daysInt, safeTz]
    );
    // Build full 7x24 grid, zero-fill missing slots
    const map = {};
    for (const row of result.rows) {
      map[`${row.dow}_${row.hour}`] = { total: parseInt(row.total), active: parseInt(row.active) };
    }
    const grid = [];
    for (let dow = 0; dow < 7; dow++) {
      for (let h = 0; h < 24; h++) {
        const slot = map[`${dow}_${h}`] || { total: 0, active: 0 };
        grid.push({
          dow,
          hour: h,
          active: slot.active,
          total: slot.total,
          pct: slot.total > 0 ? Math.round((slot.active / slot.total) * 1000) / 10 : 0
        });
      }
    }
    res.json(grid);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// Activity log — per day timeline from presence_snapshots
// Returns [{date, dow, slots:[{hour,is_active}...], active_polls, total_polls, first_active, last_active}]
router.get('/users/:userId/activity-log', auth, async (req, res) => {
  const { days = 14, tz = 'UTC' } = req.query;
  const daysInt = parseInt(days);
  const safeTz2 = tz.replace(/[^A-Za-z0-9/_+-]/g, '') || 'UTC';
  try {
    // Get every snapshot slot: date + hour + is_active count
    const result = await db.query(
      `SELECT
         (polled_at AT TIME ZONE $4)::date AS date,
         TO_CHAR(polled_at AT TIME ZONE $4, 'FMDay') AS dow,
         EXTRACT(HOUR FROM polled_at AT TIME ZONE $4)::int AS hour,
         COUNT(*) FILTER (WHERE is_active = true) AS active,
         COUNT(*) FILTER (WHERE is_active = false) AS away,
         COUNT(*) AS total
       FROM presence_snapshots
       WHERE user_id = $1 AND org_id = $2
         AND polled_at >= NOW() - ($3::int * INTERVAL '1 day')
       GROUP BY date, dow, hour
       ORDER BY date DESC, hour ASC`,
      [req.params.userId, req.org.id, daysInt, safeTz2]
    );

    // Group by date
    const byDate = {};
    for (const row of result.rows) {
      const ds = typeof row.date === 'string' ? row.date.split('T')[0] : new Date(row.date).toISOString().split('T')[0];
      if (!byDate[ds]) byDate[ds] = { date: ds, dow: row.dow.trim(), hours: [] };
      byDate[ds].hours.push({
        hour: parseInt(row.hour),
        active: parseInt(row.active),
        away: parseInt(row.away),
        total: parseInt(row.total)
      });
    }

    // Build response with summary stats per day
    const days_out = Object.values(byDate).map((day) => {
      const d = day;
      let total_active = 0, total_polls = 0, first_active = null, last_active = null;
      for (const h of d.hours) {
        total_active += h.active;
        total_polls += h.total;
        if (h.active > 0) {
          if (first_active === null) first_active = h.hour;
          last_active = h.hour;
        }
      }
      return {
        date: d.date,
        dow: d.dow,
        hours: d.hours,
        active_polls: total_active,
        total_polls,
        active_minutes: total_active * 5,
        pct: total_polls > 0 ? Math.round((total_active / total_polls) * 1000) / 10 : 0,
        first_active,
        last_active
      };
    });

    res.json(days_out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// Pro forma invoice: active hours × hourly rate per user for a date range
router.get('/reports/invoice', auth, async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });
  try {
    const users = await db.query(
      `SELECT id, display_name, price_type, price_amount, currency, project_name
       FROM tracked_users WHERE org_id=$1 AND is_active=true AND price_amount > 0`,
      [req.org.id]
    );
    if (!users.rows.length) return res.json({ from, to, lines: [], total: 0 });

    const hours = await db.query(
      `SELECT user_id,
         ROUND(COUNT(*) FILTER (WHERE is_active=true) * 5.0 / 60, 2) AS active_hours
       FROM presence_snapshots
       WHERE org_id=$1
         AND polled_at >= $2::date
         AND polled_at < $3::date + INTERVAL '1 day'
       GROUP BY user_id`,
      [req.org.id, from, to]
    );
    const hoursMap = {};
    for (const r of hours.rows) hoursMap[r.user_id] = parseFloat(r.active_hours);

    // Working days in current month for monthly→hourly conversion
    const now = new Date();
    let workingDays = 0;
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    while (d.getMonth() === now.getMonth()) {
      if (d.getDay() !== 0 && d.getDay() !== 6) workingDays++;
      d.setDate(d.getDate() + 1);
    }

    const lines = [];
    let total = 0;
    for (const u of users.rows) {
      const activeHours = hoursMap[u.id] || 0;
      if (activeHours === 0) continue;
      const monthlyRate = parseFloat(u.price_amount);
      const hourlyRate = u.price_type === 'monthly'
        ? monthlyRate / (workingDays * 8)
        : monthlyRate;
      const amount = Math.round(activeHours * hourlyRate * 100) / 100;
      total += amount;
      lines.push({
        display_name: u.display_name,
        project_name: u.project_name || null,
        price_type: u.price_type,
        price_amount: monthlyRate,
        hourly_rate: Math.round(hourlyRate * 100) / 100,
        active_hours: activeHours,
        amount,
        currency: u.currency || 'USD',
      });
    }
    lines.sort((a, b) => {
      if ((a.project_name || '') < (b.project_name || '')) return -1;
      if ((a.project_name || '') > (b.project_name || '')) return 1;
      return b.amount - a.amount;
    });
    res.json({ from, to, lines, total: Math.round(total * 100) / 100, currency: lines[0]?.currency || 'USD' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// Update cost/price for a user
router.patch('/users/:userId/billing', auth, async (req, res) => {
  const { cost_type, cost_amount, price_type, price_amount, currency, project_name } = req.body;
  try {
    await db.query(
      `UPDATE tracked_users SET
        cost_type = COALESCE($1, cost_type),
        cost_amount = $2,
        price_type = COALESCE($3, price_type),
        price_amount = $4,
        currency = COALESCE($5, currency),
        project_name = $6
       WHERE id = $7 AND org_id = $8`,
      [cost_type, cost_amount ?? null, price_type, price_amount ?? null, currency || 'USD', project_name || null, req.params.userId, req.org.id]
    );
    const result = await db.query('SELECT cost_type,cost_amount,price_type,price_amount,currency,project_name FROM tracked_users WHERE id=$1', [req.params.userId]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;