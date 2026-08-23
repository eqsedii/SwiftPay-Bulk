const AfricasTalking = require('africastalking');
const { normalizeMsisdn } = require('./mpesa');

const { AT_USERNAME, AT_API_KEY } = process.env;

const at = AfricasTalking({ apiKey: AT_API_KEY, username: AT_USERNAME });
const airtime = at.AIRTIME;
const application = at.APPLICATION;

async function sendAirtime({ recipientPhone, amountKes }) {
  const phoneNumber = '+' + normalizeMsisdn(recipientPhone);

  const response = await airtime.send({
    recipients: [{ phoneNumber, amount: `KES ${amountKes}` }],
  });

  const result = response.responses && response.responses[0];
  if (!result) throw new Error("Africa's Talking returned no response entry");
  return result;
}

async function getFloatBalance() {
  const data = await application.fetchApplicationData();
  const raw = data?.UserData?.balance || '';
  const numeric = Number(String(raw).replace(/[^0-9.-]/g, ''));
  return { raw, amount: Number.isFinite(numeric) ? numeric : null };
}

module.exports = { sendAirtime, getFloatBalance };
