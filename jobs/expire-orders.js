const { sequelize, Order, Ticket, Payment, Seat, Concert, Promotion } = require('../models');
const { Op } = require('sequelize');

let sweepRunning = false;

const expirePendingOrders = async () => {
  if (sweepRunning) return;
  sweepRunning = true;
  try {
    const dueOrders = await Order.findAll({
      where: { status: 'pending', expiryDate: { [Op.lte]: new Date() } },
      attributes: ['id']
    });

    for (const dueOrder of dueOrders) {
      await sequelize.transaction(async (transaction) => {
        const order = await Order.findByPk(dueOrder.id, {
          transaction,
          lock: transaction.LOCK.UPDATE
        });
        if (!order || order.status !== 'pending' || !order.expiryDate || order.expiryDate > new Date()) return;

        await order.update({ status: 'expired' }, { transaction });
        const tickets = await Ticket.findAll({ where: { orderId: order.id }, transaction });
        const seatIds = tickets.map((ticket) => ticket.seatId).filter(Boolean);
        if (seatIds.length) {
          await Seat.update({ status: 'available' }, {
            where: { id: seatIds, status: 'booked' },
            transaction
          });
        }
        if (tickets.length) {
          await Concert.increment('availableTickets', {
            by: tickets.length,
            where: { id: order.concertId },
            transaction
          });
        }
        await Ticket.update({ status: 'expired' }, {
          where: { orderId: order.id, status: 'active' },
          transaction
        });
        await Payment.update({ status: 'failed' }, {
          where: { orderId: order.id, status: 'pending' },
          transaction
        });
        if (order.promotionId) {
          await Promotion.decrement('usedCount', {
            by: 1,
            where: { id: order.promotionId, usedCount: { [Op.gt]: 0 } },
            transaction
          });
        }
      });
    }
  } catch (error) {
    console.error('Pending order expiry sweep failed:', error);
  } finally {
    sweepRunning = false;
  }
};

exports.startExpiryWorker = () => {
  expirePendingOrders();
  const interval = setInterval(expirePendingOrders, 30 * 1000);
  interval.unref();
  return interval;
};