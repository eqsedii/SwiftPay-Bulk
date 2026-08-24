const express = require('express');
const { pool } = require('../db');
const { getFloatBalance } = require('../services/airtime');
const { getSettings, updateSettings } = require('../services/settings');

const router = express.Router();

router.get('/float', async (req, res) => {
  try {
    const balance = await getFloatBalance();
    res.json(balance);
  } catch (err) {
    console.error('Float balance lookup failed', err.message);
    res.status(502).json({ error: "Could not reach Africa's Talking" });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE mpesa_status = 'SUCCESS' AND at_status = 'SENT')      AS successful_count,
        COUNT(*) FILTER (WHERE mpesa_status = 'SUCCESS' AND at_status = 'FAILED')    AS paid_but_failed_count,
        COUNT(*) FILTER (WHERE mpesa_status = 'FAILED')                              AS failed_payment_count,
        COUNT(*) FILTER (WHERE mpesa_status = 'PENDING')                             AS pending_count,
        COALESCE(SUM(amount_charged) FILTER (WHERE mpesa_status = 'SUCCESS' AND at_status = 'SENT'), 0) AS revenue,
        COALESCE(SUM(face_value)     FILTER (WHERE mpesa_status = 'SUCCESS' AND at_status = 'SENT'), 0) AS cost
      FROM transactions
    `);

    const row = rows[0];
    const revenue = Number(row.revenue);
    const cost = Number(row.cost);

    res.json({
      successfulCount: Number(row.successful_count),
      paidButAirtimeFailedCount: Number(row.paid_but_failed_count),
      failedPaymentCount: Number(row.failed_payment_count),
      pendingCount: Number(row.pending_count),
      revenue,
      cost,
      profit: revenue - cost,
    });
  } catch (err) {
    console.error('Summary query failed', err);
    res.status(500).json({ error: 'Could not load summary' });
  }
});

router.get('/transactions', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  try {
    const { rows } = await pool.query(
      `SELECT id, payer_phone, recipient_phone, face_value, amount_charged,
              mpesa_status, mpesa_receipt_number, at_status, created_at
         FROM transactions
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ transactions: rows });
  } catch (err) {
    console.error('Transactions query failed', err);
    res.status(500).json({ error: 'Could not load transactions' });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettings({ fresh: true });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Could not load settings' });
  }
});

router.put('/settings', async (req, res) => {
  const { discountPercent, serviceEnabled, minFloatThreshold } = req.body || {};

  if (
    discountPercent !== undefined &&
    (typeof discountPercent !== 'number' || discountPercent < 0 || discountPercent > 15)
  ) {
    return res.status(400).json({ error: 'Discount must be a number between 0 and 15' });
  }
  if (serviceEnabled !== undefined && typeof serviceEnabled !== 'boolean') {
    return res.status(400).json({ error: 'serviceEnabled must be true or false' });
  }
  if (
    minFloatThreshold !== undefined &&
    (typeof minFloatThreshold !== 'number' || minFloatThreshold < 0)
  ) {
    return res.status(400).json({ error: 'Minimum float must be a number 0 or greater' });
  }

  try {
    const updated = await updateSettings({ discountPercent, serviceEnabled, minFloatThreshold });
    res.json(updated);
  } catch (err) {
    console.error('Settings update failed', err);
    res.status(500).json({ error: 'Could not update settings' });
  }
});

module.exports = router;
