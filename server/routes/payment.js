const express = require('express');
const { pool } = require('../db');
const { initiateStkPush } = require('../services/mpesa');
const { getFloatBalance } = require('../services/airtime');
const { getSettings } = require('../services/settings');
const { priceForFaceValue, MIN_AMOUNT, MAX_AMOUNT } = require('./offers');

const router = express.Router();

const PHONE_RE = /^(?:254|0)?7\d{8}$|^(?:254|0)?1\d{8}$/;

let floatCache = { amount: null, checkedAt: 0 };
const FLOAT_CACHE_MS = 30000;

async function cachedFloatAmount() {
  if (Date.now() - floatCache.checkedAt < FLOAT_CACHE_MS) return floatCache.amount;
  try {
    const { amount } = await getFloatBalance();
    floatCache = { amount, checkedAt: Date.now() };
    return amount;
  } catch {
    return floatCache.amount;
  }
}

router.post('/', async (req, res) => {
  const settings = await getSettings();

  if (!settings.service_enabled) {
    return res.status(503).json({
      error: 'Sorry, airtime purchases are temporarily unavailable. Please try again shortly.',
    });
  }

  if (settings.min_float_threshold > 0) {
    const floatAmount = await cachedFloatAmount();
    if (floatAmount !== null && floatAmount < settings.min_float_threshold) {
      console.warn(`Blocking sale — float ${floatAmount} below threshold ${settings.min_float_threshold}`);
      return res.status(503).json({
        error: 'Sorry, airtime purchases are temporarily unavailable. Please try again shortly.',
      });
    }
  }

  const { payerPhone, recipientPhone, faceValue, offerId } = req.body || {};

  if (!payerPhone || !PHONE_RE.test(String(payerPhone).replace(/\s/g, ''))) {
    return res.status(400).json({ error: 'Enter a valid M-Pesa number' });
  }
  if (!recipientPhone || !PHONE_RE.test(String(recipientPhone).replace(/\s/g, ''))) {
    return res.status(400).json({ error: 'Enter a valid recipient number' });
  }
  const value = Number(faceValue);
  if (!Number.isFinite(value) || value < MIN_AMOUNT || value > MAX_AMOUNT) {
    return res.status(400).json({ error: `Enter an amount between Ksh ${MIN_AMOUNT} and Ksh ${MAX_AMOUNT}` });
  }

  const amountToCharge = priceForFaceValue(value, settings.discount_percent);

  try {
    const stk = await initiateStkPush({
      payerPhone,
      amount: amountToCharge,
      accountReference: 'SwiftPayBulk',
      description: `Airtime Ksh${value}`,
    });

    if (String(stk.ResponseCode) !== '0') {
      return res.status(502).json({ error: stk.ResponseDescription || 'Could not start the M-Pesa payment' });
    }

    const { rows } = await pool.query(
      `INSERT INTO transactions
        (merchant_request_id, checkout_request_id, payer_phone, recipient_phone,
         face_value, amount_charged, offer_id, mpesa_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING')
       RETURNING id, checkout_request_id`,
      [stk.MerchantRequestID, stk.CheckoutRequestID, payerPhone, recipientPhone, value, amountToCharge, offerId || null]
    );

    res.json({
      transactionId: rows[0].id,
      checkoutRequestId: rows[0].checkout_request_id,
      message: stk.CustomerMessage || 'Check your phone and enter your M-Pesa PIN.',
    });
  } catch (err) {
    console.error('STK push failed', err.response?.data || err.message);
    res.status(502).json({ error: 'Could not reach M-Pesa. Please try again.' });
  }
});

router.get('/:id/status', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, mpesa_status, mpesa_receipt_number, at_status, at_response
     FROM transactions WHERE id = $1`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

module.exports = router;
