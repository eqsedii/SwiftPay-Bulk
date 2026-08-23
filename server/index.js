require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const offersRoute = require('./routes/offers').router;
const paymentRoute = require('./routes/payment');
const mpesaCallbackRoute = require('./routes/mpesaCallback');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

const payLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many payment attempts. Please wait a moment and try again.' },
});

app.use('/api/offers', offersRoute);
app.use('/api/pay', payLimiter, paymentRoute);
app.use('/api/mpesa/callback', mpesaCallbackRoute);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SwiftPay Bulk server listening on port ${PORT}`);
});
