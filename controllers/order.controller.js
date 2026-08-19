const { Order, Ticket, Payment, User, Concert, Seat, Venue } = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');

// Generate order number
const generateOrderNumber = () => {
  return `ORD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

// @desc    Get all orders (admin)
// @route   GET /api/orders
exports.getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (status) where.status = status;
    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const orders = await Order.findAndCountAll({
      where,
      include: [
        { model: User, attributes: ['id', 'name', 'email'] },
        { model: Ticket, include: [{ model: Concert, include: [{ model: Artist }] }] },
        { model: Payment }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: orders.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: orders.count,
        totalPages: Math.ceil(orders.count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: User, attributes: ['id', 'name', 'email', 'phone'] },
        { 
          model: Ticket, 
          include: [
            { 
              model: Concert, 
              include: [
                { model: Artist },
                { model: Venue }
              ] 
            },
            { model: Seat }
          ] 
        },
        { model: Payment },
        { model: Promotion }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns the order or is admin
    if (order.UserId !== req.user.id && req.user.role === 'user') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get my orders
// @route   GET /api/orders/my-orders
exports.getMyOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;
    const where = { UserId: req.user.id };

    if (status) where.status = status;

    const orders = await Order.findAndCountAll({
      where,
      include: [
        { 
          model: Ticket, 
          include: [
            { 
              model: Concert, 
              include: [
                { model: Artist },
                { model: Venue }
              ] 
            },
            { model: Seat }
          ] 
        },
        { model: Payment },
        { model: Promotion }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: orders.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: orders.count,
        totalPages: Math.ceil(orders.count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create order
// @route   POST /api/orders
exports.createOrder = async (req, res) => {
  try {
    const { concertId, seats, customerName, customerEmail, customerPhone, promotionCode } = req.body;

    // Validate seats
    const seatsData = await Seat.findAll({
      where: {
        id: seats,
        ConcertId: concertId,
        status: 'available'
      }
    });

    if (seatsData.length !== seats.length) {
      return res.status(400).json({
        success: false,
        message: 'Some seats are not available'
      });
    }

    // Calculate total
    let totalAmount = seatsData.reduce((sum, seat) => sum + parseFloat(seat.price), 0);

    // Apply promotion if any
    let promotion = null;
    if (promotionCode) {
      promotion = await Promotion.findOne({
        where: {
          code: promotionCode,
          status: 'active',
          startDate: { [Op.lte]: new Date() },
          endDate: { [Op.gte]: new Date() },
          usedCount: { [Op.lt]: Sequelize.col('maxUses') }
        }
      });

      if (promotion) {
        if (promotion.discountType === 'percentage') {
          const discount = totalAmount * (promotion.value / 100);
          totalAmount = totalAmount - Math.min(discount, promotion.maxDiscount || discount);
        } else {
          totalAmount = totalAmount - promotion.value;
        }
        promotion.usedCount += 1;
        await promotion.save();
      }
    }

    // Create order
    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      totalAmount,
      status: 'pending',
      UserId: req.user.id,
      PromotionId: promotion ? promotion.id : null,
      customerName: customerName || req.user.name,
      customerEmail: customerEmail || req.user.email,
      customerPhone: customerPhone || req.user.phone
    });

    // Create tickets
    for (const seat of seatsData) {
      const ticketNumber = `TKT-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      await Ticket.create({
        ticketNumber,
        price: seat.price,
        status: 'active',
        SeatId: seat.id,
        OrderId: order.id,
        ConcertId: concertId
      });

      // Update seat status
      seat.status = 'booked';
      await seat.save();
    }

    // Update concert ticket count
    const concert = await Concert.findByPk(concertId);
    concert.soldTickets += seats.length;
    concert.availableTickets -= seats.length;
    await concert.save();

    res.status(201).json({
      success: true,
      data: order,
      message: 'Order created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByPk(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    await order.update({ status });

    // If order is cancelled, release seats
    if (status === 'cancelled') {
      const tickets = await Ticket.findAll({ where: { OrderId: order.id } });
      for (const ticket of tickets) {
        const seat = await Seat.findByPk(ticket.SeatId);
        if (seat) {
          seat.status = 'available';
          await seat.save();
        }
        ticket.status = 'cancelled';
        await ticket.save();
      }

      // Update concert ticket count
      const concert = await Concert.findByPk(order.ConcertId);
      if (concert) {
        concert.soldTickets -= tickets.length;
        concert.availableTickets += tickets.length;
        await concert.save();
      }
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);

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
        message: 'Not authorized to cancel this order'
      });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending orders can be cancelled'
      });
    }

    await order.update({ status: 'cancelled' });

    // Release seats
    const tickets = await Ticket.findAll({ where: { OrderId: order.id } });
    for (const ticket of tickets) {
      const seat = await Seat.findByPk(ticket.SeatId);
      if (seat) {
        seat.status = 'available';
        await seat.save();
      }
      ticket.status = 'cancelled';
      await ticket.save();
    }

    // Update concert ticket count
    const concert = await Concert.findByPk(order.ConcertId);
    if (concert) {
      concert.soldTickets -= tickets.length;
      concert.availableTickets += tickets.length;
      await concert.save();
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get order invoice
// @route   GET /api/orders/:id/invoice
exports.getOrderInvoice = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { 
          model: Ticket, 
          include: [
            { 
              model: Concert, 
              include: [
                { model: Artist },
                { model: Venue }
              ] 
            },
            { model: Seat }
          ] 
        },
        { model: Payment },
        { model: Promotion }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns the order or is admin
    if (order.UserId !== req.user.id && req.user.role === 'user') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this invoice'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};