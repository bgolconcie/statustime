const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/users', auth, async (req, res) => {
  try {
    const result = await db.query(`SELECT tu.*, i.platform, i.team_name,
      COALESCE(today.minutes,0) as today_minutes, COALESCE(week.minutes,0) as week_minutes
      FROM tracked_users tu JOIN integrations i ON tu.integration_id=i.id
      LEFT JOIN (SELECT user_id,SUM(duration_minutes) as minutes FROM time_sessions WHERE date=CURRENT_DATE GROUP BY user_id) today ON tu.id=today.user_id
      LEFT JOIN (SELECT user_id,SUM(duration_minutes) as minutes FROM time_sessions WHERE date>=CURRENT_DATE-6 GROUP BY user_id) week ON tu.id=week.user_id
      WHERE tu.org_id=$1 AND tu.is_active=true ORDER BY tu.display_name`, [req.org.id]);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/hours', auth, async (req, res) => {
  const { days=7, userId } = req.query;
  try {
    let q = `SELECT tu.id,tu.display_name,tu.avatar_url,ts.date,SUM(ts.duration_minutes) as total_minutes
      FROM time_sessions ts JOIN tracked_users tu ON ts.user_id=tu.id
      WHERE ts.org_id=$1 AND ts.date>=CURRENT_DATE-$2 AND ts.duration_minutes IS NOT NULL`;
    const params = [req.org.id, parseInt(days)-1];
    if (userId) { q += ` AND ts.user_id=$3`; params.push(userId); }
    q += ` GROUP BY tu.id,tu.display_name,tu.avatar_url,ts.date ORDER BY ts.date DESC`;
    const result = await db.query(q, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
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
    const result = await db.query(`SELECT tu.display_name,tu.email,i.platform,i.team_name,ts.date,
      SUM(ts.duration_minutes) as total_minutes, ROUND(SUM(ts.duration_minutes)::numeric/60,2) as total_hours
      FROM time_sessions ts JOIN tracked_users tu ON ts.user_id=tu.id JOIN integrations i ON tu.integration_id=i.id
      WHERE ts.org_id=$1 AND ts.date>=$2 AND ts.date<=$3
      GROUP BY tu.display_name,tu.email,i.platform,i.team_name,ts.date ORDER BY ts.date DESC,tu.display_name`,
      [req.org.id, from||'2024-01-01', to||new Date().toISOString().split('T')[0]]);
    const csv = ['Name,Email,Platform,Team,Date,Minutes,Hours',
      ...result.rows.map(r => `"${r.display_name}","${r.email||''}","${r.platform}","${r.team_name}","${r.date}",${r.total_minutes},${r.total_hours}`)].join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition',`attachment; filename=statustime-export-${Date.now()}.csv`);
    res.send(csv);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/leave', auth, async (req, res) => {
  try {
    const result = await db.query(`SELECT lr.*,tu.display_name,tu.avatar_url FROM leave_requests lr
      JOIN tracked_users tu ON lr.user_id=tu.id WHERE lr.org_id=$1 ORDER BY lr.created_at DESC LIMIT 50`, [req.org.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.patch('/leave/:id', auth, async (req, res) => {
  try {
    await db.query('UPDATE leave_requests SET status=$1 WHERE id=$2 AND org_id=$3', [req.body.status, req.params.id, req.org.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
