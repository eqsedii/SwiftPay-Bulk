const { pool } = require('../db');

let cache = null;
let cacheTime = 0;
const CACHE_MS = 5000;

async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cacheTime < CACHE_MS) return cache;

  const { rows } = await pool.query(
    'SELECT discount_percent, service_enabled, min_float_threshold FROM settings WHERE id = 1'
  );
  cache = rows[0] || { discount_percent: 5, service_enabled: true, min_float_threshold: 0 };
  cacheTime = Date.now();
  return cache;
}

async function updateSettings({ discountPercent, serviceEnabled, minFloatThreshold }) {
  const { rows } = await pool.query(
    `UPDATE settings
        SET discount_percent = COALESCE($1, discount_percent),
            service_enabled  = COALESCE($2, service_enabled),
            min_float_threshold = COALESCE($3, min_float_threshold),
            updated_at = now()
      WHERE id = 1
      RETURNING discount_percent, service_enabled, min_float_threshold`,
    [discountPercent ?? null, serviceEnabled ?? null, minFloatThreshold ?? null]
  );
  cache = rows[0];
  cacheTime = Date.now();
  return cache;
}

module.exports = { getSettings, updateSettings };
