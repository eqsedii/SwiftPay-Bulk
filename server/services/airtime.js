const AfricasTalking = require('africastalking');
const { normalizeMsisdn } = require('./mpesa');

const { AT_USERNAME, AT_API_KEY } = process.env;

const at = AfricasTalking({ apiKey: AT_API_KEY, username: AT_USERNAME });
const airtime = at.AIRTIME;

async function sendAirtime({ recipientPhone, amountKes }) {
  const phoneNumber = '+' + normalizeMsisdn(recipientPhone);

  const response = await airtime.send({
    recipients: [{ phoneNumber, amount: `KES ${amountKes}` }],
  });

  const result = response.responses && response.responses[0];
  if (!result) throw new Error("Africa's Talking returned no response entry");
  return result;
}

module.exports = { sendAirtime };
