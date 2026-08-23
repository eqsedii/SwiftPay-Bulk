const form = document.getElementById('airtime-form');
const amountInput = document.getElementById('amount');
const quoteEl = document.getElementById('quote');
const messageEl = document.getElementById('form-message');
const payBtn = document.getElementById('pay-btn');

const modal = document.getElementById('status-modal');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');
const modalSpinner = document.getElementById('modal-spinner');
const modalClose = document.getElementById('modal-close');

let quoteTimer = null;

amountInput.addEventListener('input', () => {
  clearTimeout(quoteTimer);
  const value = Number(amountInput.value);
  if (!value || value < 5) {
    quoteEl.textContent = '';
    return;
  }
  quoteTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/offers/quote?amount=${value}`);
      const data = await res.json();
      if (res.ok) {
        quoteEl.textContent = `You pay Ksh ${data.price} for Ksh ${data.faceValue} airtime (${data.discountPercent}% off)`;
      }
    } catch {
      /* quote is a nice-to-have, not required to submit */
    }
  }, 300);
});

function showModal({ title, text, spinning, showClose }) {
  modal.classList.remove('hidden');
  modalTitle.textContent = title;
  modalText.textContent = text;
  modalSpinner.style.display = spinning ? 'block' : 'none';
  modalClose.classList.toggle('hidden', !showClose);
}
function hideModal() {
  modal.classList.add('hidden');
}
modalClose.addEventListener('click', hideModal);

async function pollStatus(transactionId, { intervalMs = 3000, timeoutMs = 90000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`/api/pay/${transactionId}/status`);
    if (res.ok) {
      const data = await res.json();
      if (data.mpesa_status === 'SUCCESS') return { ok: true, data };
      if (data.mpesa_status === 'FAILED') return { ok: false, data };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { ok: false, timedOut: true };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  messageEl.textContent = '';

  const payerPhone = document.getElementById('payerPhone').value.trim();
  const recipientPhone = document.getElementById('recipientPhone').value.trim();
  const faceValue = Number(amountInput.value);

  if (!document.getElementById('terms').checked) {
    messageEl.textContent = 'Please agree to the terms and conditions.';
    return;
  }

  const captchaResponse = typeof grecaptcha !== 'undefined' ? grecaptcha.getResponse() : '';
  if (!captchaResponse) {
    messageEl.textContent = 'Please complete the "I\'m not a robot" check.';
    return;
  }

  payBtn.disabled = true;
  payBtn.textContent = 'Sending request…';

  try {
    const res = await fetch('/api/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payerPhone, recipientPhone, faceValue }),
    });
    const data = await res.json();

    if (!res.ok) {
      messageEl.textContent = data.error || 'Something went wrong. Please try again.';
      payBtn.disabled = false;
      payBtn.textContent = 'Pay';
      if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
      return;
    }

    showModal({
      title: 'Check your phone',
      text: data.message || 'Enter your M-Pesa PIN to complete payment.',
      spinning: true,
      showClose: false,
    });

    const result = await pollStatus(data.transactionId);

    if (result.ok) {
      showModal({
        title: 'Payment received ✅',
        text: `Airtime is on its way to ${recipientPhone}.`,
        spinning: false,
        showClose: true,
      });
      form.reset();
      quoteEl.textContent = '';
    } else if (result.timedOut) {
      showModal({
        title: 'Still waiting',
        text: 'We have not received confirmation yet. If your M-Pesa was deducted, airtime will still be sent shortly.',
        spinning: false,
        showClose: true,
      });
    } else {
      showModal({
        title: 'Payment not completed',
        text: result.data?.mpesa_result_desc || 'The payment was cancelled or failed. No airtime was sent.',
        spinning: false,
        showClose: true,
      });
    }
  } catch (err) {
    messageEl.textContent = 'Network error. Please check your connection and try again.';
  } finally {
    payBtn.disabled = false;
    payBtn.textContent = 'Pay';
    if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
  }
});
