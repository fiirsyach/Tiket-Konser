const path = require('path');
const dotenv = require('dotenv');
const midtransClient = require('midtrans-client');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const serverKey = process.env.MIDTRANS_SERVER_KEY;
const clientKey = process.env.MIDTRANS_CLIENT_KEY;
const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const isEnabled = process.env.PAYMENT_GATEWAY_ENABLED !== 'false';
const isConfigured = isEnabled && Boolean(serverKey && clientKey);

const snap = isConfigured
  ? new midtransClient.Snap({ isProduction, serverKey, clientKey })
  : null;

module.exports = { snap, isConfigured, isEnabled, isProduction };