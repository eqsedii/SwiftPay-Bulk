const express = require('express');
const { pool } = require('../db');

const router = express.Router();

function priceForFaceValue(faceValue, discountPercent = 5) {
  return Math.round(faceValue * (1 - discountPercent / 100));
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, label, face_value, discount_percent, price FROM offers WHERE is_active = true ORDER BY face_value ASC'
    );
    res.json({ offers: rows });
  } catch (err) {
    console.error('GET /api/offers failed', err);
    res.status(500).json({ error: 'Could not load offers' });
  }
});

router.get('/quote', (req, res) => {
  const faceValue = Number(req.query.amount);
  if (!Number.isFinite(faceValue) || faceValue < 5) {
    return res.status(400).json({ error: 'Enter a valid amount (minimum Ksh 5)' });
  }
  const price = priceForFaceValue(faceValue, 5);
  res.json({ faceValue, discountPercent: 5, price });
});

module.exports = { router, priceForFaceValue };
