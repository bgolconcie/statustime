const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => { console.error('DB error', err); });

const query = (text, params) => pool.query(text, params);

const migrate = async () => {
  const fs = require('fs');
  const path = require('path');
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('Database migrated successfully');
  } catch (err) {
    console.error('Migration error:', err.message);
    throw err;
  }
};

module.exports = { query, pool, migrate };
