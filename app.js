const form = document.getElementById('airtime-form');
const amountInput = document.getElementById('amount');
const quoteEl = document.getElementById('quote');
const messageEl = document.getElementById('form-message');
const payBtn = document.getElementById('pay-btn');

// Live "you pay Ksh X" preview — 5% discount, calculated in the browser for now.
amountInput.addEventListener('input', () => {
  const value = Number(amountInput.value);
  if (!value || value < 5) {
    quoteEl.textContent = '';
    return;
  }
  const price = Math.round(value * 0.95);
  quoteEl.textContent = `You pay Ksh ${price} for Ksh ${value} airtime (5% off)`;
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  messageEl.textContent = '';

  if (!document.getElementById('terms').checked) {
    messageEl.textContent = 'Please agree to the terms and conditions.';
    return;
  }

  const captchaResponse = typeof grecaptcha !== 'undefined' ? grecaptcha.getResponse() : '';
  if (!captchaResponse) {
    messageEl.textContent = 'Please complete the "I\'m not a robot" check.';
    return;
  }

  // Payment isn't wired up yet — this is just a placeholder for now.
  messageEl.style.color = '#1a8c3f';
  messageEl.textContent = 'Payments are coming soon — this form is not live yet.';

  if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
});
