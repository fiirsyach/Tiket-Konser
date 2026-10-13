const { sequelize, Order, Payment, Ticket, TicketCategory, Concert, Seat } = require('../models');
const { ensureTicketQr } = require('./ticketQr');

exports.completePayment = async (paymentId, responseData) => {
  const paymentSummary = await Payment.findByPk(paymentId, { attributes: ['orderId'] });
  if (!paymentSummary) {
    const error = new Error('Payment not found');
    error.status = 404;
    throw error;
  }

  const { payment, orderId } = await sequelize.transaction(async (transaction) => {
    const order = await Order.findByPk(paymentSummary.orderId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    const payment = await Payment.findByPk(paymentId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!payment) {
      const error = new Error('Payment not found');
      error.status = 404;
      throw error;
    }
    if (payment.status === 'completed') return { payment, orderId: payment.orderId };
    if (!['pending', 'processing'].includes(payment.status)) {
      const error = new Error('Payment is no longer pending');
      error.status = 409;
      throw error;
    }
    if (!order || order.status !== 'pending' || (order.expiryDate && order.expiryDate <= new Date())) {
      const error = new Error('Order is no longer payable');
      error.status = 409;
      throw error;
    }

    const tickets = await Ticket.findAll({
      where: { orderId: order.id, status: 'active' },
      transaction
    });
    const paidAt = new Date();
    await payment.update({ status: 'completed', paidAt, responseData }, { transaction });
    await order.update({ status: 'paid', paymentDate: paidAt }, { transaction });
    await Concert.increment('soldTickets', { by: tickets.length, where: { id: order.concertId }, transaction });

    const categoryCounts = new Map();
    tickets.forEach((ticket) => {
      if (ticket.ticketCategoryId) {
        categoryCounts.set(ticket.ticketCategoryId, (categoryCounts.get(ticket.ticketCategoryId) || 0) + 1);
      }
    });
    for (const [categoryId, quantity] of categoryCounts) {
      await TicketCategory.increment('sold', { by: quantity, where: { id: categoryId }, transaction });
    }

    return { payment, orderId: order.id };
  });

  const tickets = await Ticket.findAll({
    where: { orderId, status: 'active' },
    include: [{ model: Seat, as: 'seat' }]
  });
  for (const ticket of tickets) {
    await ensureTicketQr(ticket);
  }

  return payment;
};
