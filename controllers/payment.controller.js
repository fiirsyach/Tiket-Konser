const { Payment, Order, Ticket, Seat, Concert } = require('../models');
const { Op } = require('sequelize');
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

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns the order
    if (order.UserId !== req.user.id) {
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
    const existingPayment = await Payment.findOne({ where: { OrderId: order.id } });
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
      OrderId: order.id,
      paymentData: {
        method,
        orderId: order.orderNumber
      }
    });

    // Generate payment URL (mock)
    const paymentUrl = `https://payment.example.com/pay/${transactionId}`;

    // Update order with payment method
    await order.update({ paymentMethod: method });

    res.status(201).json({
      success: true,
      data: {
        payment,
        paymentUrl,
        amount: order.totalAmount,
        orderNumber: order.orderNumber
      }
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
      include: [{ model: Order }]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Payment is not pending'
      });
    }

    // Process payment (mock)
    // In real implementation, integrate with payment gateway
    const success = Math.random() > 0.2; // 80% success rate for demo

    if (success) {
      await payment.update({
        status: 'completed',
        paidAt: new Date(),
        responseData: { status: 'success', transactionId: payment.transactionId }
      });

      // Update order status
      await payment.Order.update({ 
        status: 'paid',
        paymentDate: new Date()
      });

      // Update ticket status to active
      const tickets = await Ticket.findAll({ where: { OrderId: payment.Order.id } });
      for (const ticket of tickets) {
        ticket.status = 'active';
        await ticket.save();
      }

      res.json({
        success: true,
        message: 'Payment processed successfully',
        data: payment
      });
    } else {
      await payment.update({
        status: 'failed',
        responseData: { status: 'failed', message: 'Payment failed' }
      });

      res.status(400).json({
        success: false,
        message: 'Payment failed'
      });
    }
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
      include: [{ model: Order }]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if user owns the payment
    if (payment.Order.UserId !== req.user.id && req.user.role === 'user') {
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
  try {
    const { transactionId, status, data } = req.body;

    const payment = await Payment.findOne({ 
      where: { transactionId },
      include: [{ model: Order }]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (status === 'success') {
      await payment.update({
        status: 'completed',
        paidAt: new Date(),
        responseData: data
      });

      await payment.Order.update({ 
        status: 'paid',
        paymentDate: new Date()
      });

      // Update tickets
      const tickets = await Ticket.findAll({ where: { OrderId: payment.Order.id } });
      for (const ticket of tickets) {
        ticket.status = 'active';
        await ticket.save();
      }
    } else {
      await payment.update({
        status: 'failed',
        responseData: data
      });
    }

    res.json({
      success: true,
      message: 'Callback processed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Refund payment
// @route   POST /api/payments/:id/refund
exports.refundPayment = async (req, res) => {
  try {
    const { reason, amount } = req.body;
    const payment = await Payment.findByPk(req.params.id, {
      include: [{ model: Order }]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Only completed payments can be refunded'
      });
    }

    // Process refund (mock)
    const refundAmount = amount || payment.amount;

    await payment.update({
      status: 'refunded',
      refundAmount,
      refundReason: reason,
      refundedAt: new Date()
    });

    // Update order status
    await payment.Order.update({ status: 'refund' });

    // Update tickets
    const tickets = await Ticket.findAll({ where: { OrderId: payment.Order.id } });
    for (const ticket of tickets) {
      ticket.status = 'refunded';
      await ticket.save();
      
      // Release seats
      const seat = await Seat.findByPk(ticket.SeatId);
      if (seat) {
        seat.status = 'available';
        await seat.save();
      }
    }

    // Update concert ticket count
    const concert = await Concert.findByPk(payment.Order.ConcertId);
    if (concert) {
      concert.soldTickets -= tickets.length;
      concert.availableTickets += tickets.length;
      await concert.save();
    }

    res.json({
      success: true,
      message: 'Payment refunded successfully',
      data: payment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};