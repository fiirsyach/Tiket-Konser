const { Payment, Order, Ticket, TicketCategory, Seat, Concert, sequelize } = require('../models');
const crypto = require('crypto');

// @desc    Get payment methods
// @route   GET /api/payments/methods
exports.getPaymentMethods = async (req, res) => {
  try {
    const methods = [
      { id: 'qris', name: 'QRIS', icon: 'qris', available: true },
      { id: 'bca_va', name: 'BCA Virtual Account', icon: 'bca', available: true },
      { id: 'mandiri_va', name: 'Mandiri Virtual Account', icon: 'mandiri', available: true },
      { id: 'bni_va', name: 'BNI Virtual Account', icon: 'bni', available: true },
      { id: 'ovo', name: 'OVO', icon: 'ovo', available: true },
      { id: 'gopay', name: 'GoPay', icon: 'gopay', available: true },
      { id: 'shopeepay', name: 'ShopeePay', icon: 'shopeepay', available: true },
      { id: 'dana', name: 'DANA', icon: 'dana', available: true }
    ];

    res.json({
      success: true,
      data: methods
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create payment
// @route   POST /api/payments/create
exports.createPayment = async (req, res) => {
  try {
    const { orderId, method } = req.body;
    const allowedMethods = ['qris', 'bca_va', 'mandiri_va', 'bni_va', 'ovo', 'gopay', 'shopeepay', 'dana', 'credit_card'];
    if (!allowedMethods.includes(method)) {
      return res.status(400).json({ success: false, message: 'Unsupported payment method' });
    }

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns the order
    if (order.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to pay this order'
      });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Order is not pending'
      });
    }

    // Check if payment already exists
    const existingPayment = await Payment.findOne({ where: { orderId: order.id } });
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: 'Payment already exists for this order'
      });
    }

    // Generate transaction ID
    const transactionId = `PAY-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const payment = await Payment.create({
      amount: order.totalAmount,
      method,
      status: 'pending',
      transactionId,
      orderId: order.id,
      paymentData: {
        method,
        orderId: order.orderNumber
      }
    });

    // Update order with payment method
    await order.update({ paymentMethod: method });

    res.status(201).json({
      success: true,
      data: {
        payment,
        paymentUrl: null,
        amount: order.totalAmount,
        orderNumber: order.orderNumber,
        gatewayConfigured: false
      },
      message: 'Payment intent created; payment gateway is not configured'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Process payment
// @route   POST /api/payments/:id/process
exports.processPayment = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id, {
      include: [{ model: Order, as: 'order' }]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.order.userId !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to process this payment' });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Payment is not pending'
      });
    }

    return res.status(501).json({
      success: false,
      message: 'Payment gateway is not configured; payment status was not changed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get payment status
// @route   GET /api/payments/:id/status
exports.getPaymentStatus = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id, {
      include: [{ model: Order, as: 'order' }]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if user owns the payment
    if (payment.order.userId !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this payment'
      });
    }

    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Handle payment callback (webhook)
// @route   POST /api/payments/callback
exports.handlePaymentCallback = async (req, res) => {
  return res.status(501).json({
    success: false,
    message: 'Payment callback is disabled until a signed gateway integration is configured'
  });
};

// @desc    Refund payment
// @route   POST /api/payments/:id/refund
exports.refundPayment = async (req, res) => {
  try {
    const { reason, amount } = req.body;
    const paymentSummary = await Payment.findByPk(req.params.id, { attributes: ['id', 'orderId', 'amount'] });
    if (!paymentSummary) return res.status(404).json({ success: false, message: 'Payment not found' });
    const refundAmount = amount === undefined ? Number(paymentSummary.amount) : Number(amount);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > Number(paymentSummary.amount)) {
      return res.status(400).json({ success: false, message: 'Refund amount must be positive and cannot exceed the payment' });
    }

    const refund = await sequelize.transaction(async (transaction) => {
      const order = await Order.findByPk(paymentSummary.orderId, { transaction, lock: transaction.LOCK.UPDATE });
      const payment = await Payment.findByPk(paymentSummary.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!order || !payment || payment.status !== 'completed' || order.status !== 'paid') {
        const error = new Error('Only paid orders can be refunded');
        error.status = 400;
        throw error;
      }
      const tickets = await Ticket.findAll({ where: { orderId: order.id }, transaction });
      if (tickets.some((ticket) => ticket.status === 'used')) {
        const error = new Error('Used tickets cannot be refunded');
        error.status = 409;
        throw error;
      }
      if (!String(reason || '').trim()) {
        const error = new Error('Refund reason is required');
        error.status = 400;
        throw error;
      }

      await payment.update({ status: 'refunded', refundAmount, refundReason: reason.trim(), refundedAt: new Date() }, { transaction });
      await order.update({ status: 'refunded' }, { transaction });
      await Ticket.update({ status: 'refunded' }, { where: { orderId: order.id, status: 'active' }, transaction });
      const seatIds = tickets.map((ticket) => ticket.seatId).filter(Boolean);
      if (seatIds.length) {
        await Seat.update({ status: 'available' }, { where: { id: seatIds, status: 'booked' }, transaction });
      }
      if (tickets.length) {
        await Concert.increment({ soldTickets: -tickets.length, availableTickets: tickets.length }, { where: { id: order.concertId }, transaction });
      }
      const categoryCounts = new Map();
      tickets.forEach((ticket) => {
        if (ticket.ticketCategoryId) categoryCounts.set(ticket.ticketCategoryId, (categoryCounts.get(ticket.ticketCategoryId) || 0) + 1);
      });
      for (const [categoryId, quantity] of categoryCounts) {
        await TicketCategory.decrement('sold', { by: quantity, where: { id: categoryId, sold: { [Op.gte]: quantity } }, transaction });
      }
      return payment;
    });

    res.json({
      success: true,
      message: 'Refund recorded. Transfer must be completed through the configured payment provider or manually.',
      data: refund
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
};