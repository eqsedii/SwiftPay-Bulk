const express = require('express');
const { pool } = require('../db');
const { getSettings } = require('../services/settings');

const router = express.Router();

function priceForFaceValue(faceValue, discountPercent) {
  return Math.round(faceValue * (1 - discountPercent / 100));
}

router.get('/', async (req, res) => {
  try {
    const settings = await getSettings();
    const { rows } = await pool.query(
      'SELECT id, label, face_value FROM offers WHERE is_active = true ORDER BY face_value ASC'
    );
    const offers = rows.map((o) => ({
      ...o,
      discount_percent: settings.discount_percent,
      price: priceForFaceValue(o.face_value, settings.discount_percent),
    }));
    res.json({ offers, discountPercent: settings.discount_percent });
  } catch (err) {
    console.error('GET /api/offers failed', err);
    res.status(500).json({ error: 'Could not load offers' });
  }
});

router.get('/quote', async (req, res) => {
  const faceValue = Number(req.query.amount);
  if (!Number.isFinite(faceValue) || faceValue < 5) {
    return res.status(400).json({ error: 'Enter a valid amount (minimum Ksh 5)' });
  }
  try {
    const settings = await getSettings();
    const price = priceForFaceValue(faceValue, settings.discount_percent);
    res.json({ faceValue, discountPercent: settings.discount_percent, price });
  } catch (err) {
    res.status(500).json({ error: 'Could not calculate price' });
  }
});

module.exports = { router, priceForFaceValue };
