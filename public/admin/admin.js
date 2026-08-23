const onLoginPage = !!document.getElementById('login-form');
const onDashboardPage = !!document.getElementById('float-amount');

const fmtKes = (n) =>
  n === null || n === undefined ? '—' : `Ksh ${Number(n).toLocaleString()}`;

if (onLoginPage) {
  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        errorEl.textContent = data.error || 'Login failed';
        return;
      }
      window.location.href = 'dashboard.html';
    } catch {
      errorEl.textContent = 'Network error. Please try again.';
    }
  });
}

if (onDashboardPage) {
  let txnOffset = 0;
  const TXN_PAGE_SIZE = 50;

  async function requireLogin() {
    const res = await fetch('/api/admin/me');
    const data = await res.json();
    if (!data.loggedIn) window.location.href = 'index.html';
  }

  async function loadFloat() {
    try {
      const res = await fetch('/api/admin/float');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      document.getElementById('float-amount').textContent =
        data.amount !== null ? fmtKes(data.amount) : data.raw || '—';
    } catch {
      document.getElementById('float-amount').textContent = 'Unavailable';
    }
  }

  async function loadSummary() {
    try {
      const res = await fetch('/api/admin/summary');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      document.getElementById('revenue-amount').textContent = fmtKes(data.revenue);
      document.getElementById('cost-amount').textContent = fmtKes(data.cost);
      document.getElementById('profit-amount').textContent = fmtKes(data.profit);
      document.getElementById('count-success').textContent = data.successfulCount;
      document.getElementById('count-paid-failed').textContent = data.paidButAirtimeFailedCount;
      document.getElementById('count-failed').textContent = data.failedPaymentCount;
      document.getElementById('count-pending').textContent = data.pendingCount;
      if (data.paidButAirtimeFailedCount > 0) {
        document.getElementById('float-warning').textContent =
          `${data.paidButAirtimeFailedCount} paid transaction(s) failed to receive airtime — review below.`;
      }
    } catch {
      /* leave placeholders */
    }
  }

  async function loadSettings() {
    const res = await fetch('/api/admin/settings');
    const data = await res.json();
    document.getElementById('service-toggle').checked = data.service_enabled;
    document.getElementById('discount-input').value = data.discount_percent;
  }

  function statusBadge(text, kind) {
    const cls = kind === 'ok' ? 'badge-ok' : kind === 'fail' ? 'badge-fail' : 'badge-pending';
    return `<span class="${cls}">${text}</span>`;
  }

  async function loadTransactions(reset = false) {
    if (reset) {
      txnOffset = 0;
      document.getElementById('txn-tbody').innerHTML = '';
    }
    const res = await fetch(`/api/admin/transactions?limit=${TXN_PAGE_SIZE}&offset=${txnOffset}`);
    const data = await res.json();
    const tbody = document.getElementById('txn-tbody');

    if (txnOffset === 0) tbody.innerHTML = '';

    if (!data.transactions || !data.transactions.length) {
      if (txnOffset === 0) tbody.innerHTML = '<tr><td colspan="8">No transactions yet.</td></tr>';
      return;
    }

    for (const t of data.transactions) {
      const mpesaBadge =
        t.mpesa_status === 'SUCCESS' ? statusBadge('Paid', 'ok') :
        t.mpesa_status === 'FAILED' ? statusBadge('Failed', 'fail') :
        statusBadge('Pending', 'pending');

      const atBadge =
        t.at_status === 'SENT' ? statusBadge('Sent', 'ok') :
        t.at_status === 'FAILED' ? statusBadge('Failed', 'fail') :
        statusBadge(t.at_status.replace('_', ' '), 'pending');

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${new Date(t.created_at).toLocaleString()}</td>
        <td>${t.payer_phone}</td>
        <td>${t.recipient_phone}</td>
        <td>${fmtKes(t.amount_charged)}</td>
        <td>${fmtKes(t.face_value)}</td>
        <td>${mpesaBadge}</td>
        <td>${atBadge}</td>
        <td>${t.mpesa_receipt_number || '—'}</td>
      `;
      tbody.appendChild(row);
    }
    txnOffset += data.transactions.length;
  }

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = 'index.html';
  });

  document.getElementById('service-toggle').addEventListener('change', async (e) => {
    const msgEl = document.getElementById('settings-message');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceEnabled: e.target.checked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      msgEl.style.color = '#1a8c3f';
      msgEl.textContent = e.target.checked ? 'Purchases enabled.' : 'Purchases disabled for customers.';
    } catch (err) {
      e.target.checked = !e.target.checked;
      msgEl.style.color = '#d21e1e';
      msgEl.textContent = 'Could not update — please try again.';
    }
  });

  document.getElementById('save-discount-btn').addEventListener('click', async () => {
    const msgEl = document.getElementById('settings-message');
    const value = Number(document.getElementById('discount-input').value);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discountPercent: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      msgEl.style.color = '#1a8c3f';
      msgEl.textContent = `Discount updated to ${value}%.`;
    } catch (err) {
      msgEl.style.color = '#d21e1e';
      msgEl.textContent = err.message || 'Could not update discount.';
    }
  });

  document.getElementById('load-more-btn').addEventListener('click', () => loadTransactions(false));

  (async () => {
    await requireLogin();
    loadFloat();
    loadSummary();
    loadSettings();
    loadTransactions(true);
  })();
        }
