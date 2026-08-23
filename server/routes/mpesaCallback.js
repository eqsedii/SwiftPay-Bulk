const express = require('express');
const { pool } = require('../db');
const { sendAirtime } = require('../services/airtime');

const router = express.Router();

router.post('/', async (req, res) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Received' });

  try {
    const body = req.body?.Body?.stkCallback;
    if (!body) return;

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = body;

    let mpesaReceiptNumber = null;
    if (CallbackMetadata?.Item) {
      for (const item of CallbackMetadata.Item) {
        if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = item.Value;
      }
    }

    const newStatus = ResultCode === 0 ? 'SUCCESS' : 'FAILED';

    const { rows } = await pool.query(
      `UPDATE transactions
         SET mpesa_status = $1, mpesa_receipt_number = $2, mpesa_result_code = $3,
             mpesa_result_desc = $4, mpesa_raw_callback = $5
       WHERE checkout_request_id = $6 AND mpesa_status = 'PENDING'
       RETURNING id, recipient_phone, face_value`,
      [newStatus, mpesaReceiptNumber, ResultCode, ResultDesc, JSON.stringify(body), CheckoutRequestID]
    );

    if (!rows.length) return;
    const txn = rows[0];
    if (newStatus !== 'SUCCESS') return;

    await pool.query(`UPDATE transactions SET at_status = 'QUEUED' WHERE id = $1`, [txn.id]);

    try {
      const atResult = await sendAirtime({ recipientPhone: txn.recipient_phone, amountKes: txn.face_value });
      const sentOk = String(atResult.status).toLowerCase() === 'success';
      await pool.query(
        `UPDATE transactions SET at_status = $1, at_request_id = $2, at_response = $3 WHERE id = $4`,
        [sentOk ? 'SENT' : 'FAILED', atResult.requestId || null, JSON.stringify(atResult), txn.id]
      );
    } catch (atErr) {
      console.error(`Africa's Talking send failed for txn ${txn.id}`, atErr.message);
      await pool.query(
        `UPDATE transactions SET at_status = 'FAILED', at_response = $1 WHERE id = $2`,
        [JSON.stringify({ error: atErr.message }), txn.id]
      );
    }
  } catch (err) {
    console.error('Error processing M-Pesa callback', err);
  }
});

module.exports = router;
