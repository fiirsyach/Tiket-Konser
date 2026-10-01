const crypto = require('crypto');
const QRCode = require('qrcode');

const getSecret = () => {
  const secret = process.env.TICKET_QR_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('TICKET_QR_SECRET or JWT_SECRET must be configured');
  return secret;
};

const signPayload = (encodedPayload) => crypto
  .createHmac('sha256', getSecret())
  .update(encodedPayload)
  .digest('base64url');

const createTicketPayload = (ticket) => ({
  ticketId: ticket.id,
  ticketNumber: ticket.ticketNumber,
  concertId: ticket.concertId,
  orderId: ticket.orderId,
  seatId: ticket.seatId || null,
  row: ticket.seat?.row || null,
  number: ticket.seat?.number || null,
  section: ticket.seat?.sectionName || null
});

exports.ensureTicketQr = async (ticket) => {
  if (ticket.qrCode) return ticket.qrCode;
  const payload = Buffer.from(JSON.stringify(createTicketPayload(ticket))).toString('base64url');
  const token = `${payload}.${signPayload(payload)}`;
  ticket.qrCode = await QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 2 });
  await ticket.save();
  return ticket.qrCode;
};

exports.verifyTicketQr = (token) => {
  if (typeof token !== 'string') return null;
  const [encodedPayload, signature, extra] = token.split('.');
  if (!encodedPayload || !signature || extra) return null;

  try {
    const expected = Buffer.from(signPayload(encodedPayload));
    const supplied = Buffer.from(signature);
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

