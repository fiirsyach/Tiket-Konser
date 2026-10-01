const { Order, Ticket, TicketCategory, Payment, User, Concert, Seat, Venue, Artist, Promotion, sequelize } = require('../models');
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
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: Ticket, as: 'orderTickets', include: [{ model: Concert, as: 'concert' }] },
        { model: Payment, as: 'orderPayment' }
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
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone'] },
        { 
          model: Ticket, 
          as: 'orderTickets',
          include: [
            { 
              model: Concert, 
              as: 'concert',
              include: [
                { model: Artist, as: 'artist' },
                { model: Venue, as: 'venue' }
              ] 
            },
            { model: Seat, as: 'seat' }
          ] 
        },
        { model: Payment, as: 'orderPayment' },
        { model: Promotion, as: 'promotion' }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.userId !== req.user.id && req.user.role === 'customer') {
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
    const where = { userId: req.user.id };

    if (status) where.status = status;

    const orders = await Order.findAndCountAll({
      where,
      include: [
        { 
          model: Ticket,
          as: 'orderTickets',
          include: [
            { 
              model: Concert,
              as: 'concert',
              include: [
                { model: Artist, as: 'artist' },
                { model: Venue, as: 'venue' }
              ] 
            },
            { model: Seat, as: 'seat' }
          ] 
        },
        { model: Payment, as: 'orderPayment' },
        { model: Promotion, as: 'promotion' }
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
    const { concertId, seats, categories, paymentMethod, customerName, customerEmail, customerPhone, customerNIK, promotionCode } = req.body;
    const numericConcertId = Number(concertId);
    if (!Number.isInteger(numericConcertId) || numericConcertId <= 0) {
      return res.status(400).json({ success: false, message: 'Concert is required' });
    }

    const selectedSeatIds = Array.isArray(seats) ? seats.map((seat) => Number(seat)) : [];
    const requestedCategories = Array.isArray(categories) ? categories.map((item) => ({
      ticketCategoryId: Number(item.ticketCategoryId),
      quantity: Number(item.quantity)
    })) : [];
    const categoryQuantity = requestedCategories.reduce((sum, item) => sum + item.quantity, 0);
    const hasSeats = selectedSeatIds.length > 0;
    const hasCategories = requestedCategories.length > 0;
    if (hasSeats === hasCategories || (hasSeats && (selectedSeatIds.length > 10 || selectedSeatIds.some((id) => !Number.isInteger(id) || id <= 0) || new Set(selectedSeatIds).size !== selectedSeatIds.length)) || (hasCategories && (categoryQuantity > 10 || requestedCategories.some((item) => !Number.isInteger(item.ticketCategoryId) || item.ticketCategoryId <= 0 || !Number.isInteger(item.quantity) || item.quantity <= 0) || new Set(requestedCategories.map((item) => item.ticketCategoryId)).size !== requestedCategories.length))) {
      return res.status(400).json({ success: false, message: 'Select between 1 and 10 tickets using seats or ticket categories' });
    }

    const order = await sequelize.transaction(async (transaction) => {
      const concert = await Concert.findOne({
        where: {
          id: numericConcertId,
          status: { [Op.in]: ['published', 'on_sale', 'upcoming'] }
        },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!concert) {
        const error = new Error('Concert not found');
        error.status = 404;
        throw error;
      }

      let seatsData = [];
      let categoryItems = [];
      if (hasSeats) {
        seatsData = await Seat.findAll({
          where: { id: selectedSeatIds, concertId: numericConcertId, status: 'available' },
          transaction,
          lock: transaction.LOCK.UPDATE
        });
        if (seatsData.length !== selectedSeatIds.length) {
          const error = new Error('Some selected seats are no longer available');
          error.status = 409;
          throw error;
        }
      } else {
        const ticketCategories = await TicketCategory.findAll({
          where: { id: requestedCategories.map((item) => item.ticketCategoryId), concertId: numericConcertId, status: 'active' },
          transaction,
          lock: transaction.LOCK.UPDATE
        });
        if (ticketCategories.length !== requestedCategories.length) {
          const error = new Error('One or more ticket categories are unavailable');
          error.status = 409;
          throw error;
        }

        const categoriesById = new Map(ticketCategories.map((category) => [category.id, category]));
        for (const request of requestedCategories) {
          const ticketCategory = categoriesById.get(request.ticketCategoryId);
          const pendingCount = await Ticket.count({
            where: { ticketCategoryId: ticketCategory.id, status: 'active' },
            include: [{ model: Order, as: 'order', where: { status: 'pending', expiryDate: { [Op.gt]: new Date() } }, attributes: [] }],
            transaction
          });
          if (Number(ticketCategory.sold) + pendingCount + request.quantity > Number(ticketCategory.quota)) {
            const error = new Error(`Not enough tickets available in ${ticketCategory.category}`);
            error.status = 409;
            throw error;
          }
          categoryItems.push({ ticketCategory, quantity: request.quantity });
        }
      }

      const totalQuantity = hasSeats ? seatsData.length : categoryQuantity;
      if (Number(concert.availableTickets || 0) < totalQuantity) {
        const error = new Error('Not enough tickets available for this concert');
        error.status = 409;
        throw error;
      }
      const subtotal = hasSeats
        ? seatsData.reduce((sum, seat) => sum + Number(seat.price || 0), 0)
        : categoryItems.reduce((sum, item) => sum + Number(item.ticketCategory.price) * item.quantity, 0);
      const serviceFee = subtotal * 0.05;
      let discount = 0;
      let promotion = null;
      if (promotionCode) {
        promotion = await Promotion.findOne({
          where: {
            code: String(promotionCode).trim().toUpperCase(),
            status: 'active',
            startDate: { [Op.lte]: new Date() },
            endDate: { [Op.gte]: new Date() }
          },
          transaction,
          lock: transaction.LOCK.UPDATE
        });
        if (!promotion) {
          const error = new Error('Promotion is invalid or expired');
          error.status = 400;
          throw error;
        }
        if (promotion.maxUses && promotion.usedCount >= promotion.maxUses) {
          const error = new Error('Promotion usage limit reached');
          error.status = 400;
          throw error;
        }
        if (promotion.minPurchase && subtotal < Number(promotion.minPurchase)) {
          const error = new Error('Order does not meet the promotion minimum purchase');
          error.status = 400;
          throw error;
        }
        if (Array.isArray(promotion.applicableConcerts) && promotion.applicableConcerts.length && !promotion.applicableConcerts.map(Number).includes(numericConcertId)) {
          const error = new Error('Promotion does not apply to this concert');
          error.status = 400;
          throw error;
        }
        const useCount = await Order.count({ where: { userId: req.user.id, promotionId: promotion.id }, transaction });
        if (promotion.perUserLimit && useCount >= promotion.perUserLimit) {
          const error = new Error('You have reached this promotion usage limit');
          error.status = 400;
          throw error;
        }
        discount = promotion.discountType === 'percentage'
          ? Math.min((subtotal + serviceFee) * (Number(promotion.value) / 100), Number(promotion.maxDiscount || subtotal + serviceFee))
          : Number(promotion.value || 0);
      }
      const totalAmount = Math.max(0, subtotal + serviceFee - discount);

      const createdOrder = await Order.create({
        orderNumber: generateOrderNumber(),
        userId: req.user.id,
        concertId: numericConcertId,
        organizerId: concert.organizerId,
        promotionId: promotion?.id || null,
        subtotal: subtotal.toFixed(2),
        serviceFee: serviceFee.toFixed(2),
        discount: discount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        status: 'pending',
        paymentMethod: paymentMethod || 'qris',
        customerName: customerName || req.user.name,
        customerEmail: customerEmail || req.user.email,
        customerPhone: customerPhone || req.user.phone,
        customerNIK: customerNIK || null,
        expiryDate: new Date(Date.now() + 15 * 60 * 1000)
      }, { transaction });

      const categories = await TicketCategory.findAll({
        where: { concertId: numericConcertId },
        transaction
      });
      const categoriesByName = new Map(categories.map((category) => [category.category.toLowerCase(), category]));
      const ticketCategoryLabels = { vvip: 'VVIP', vip: 'VIP', regular: 'Regular', platinum: 'Platinum', diamond: 'Diamond', festival: 'Festival' };
      const tickets = hasSeats
        ? seatsData.map((seat) => ({
          organizerId: concert.organizerId,
          concertId: numericConcertId,
          orderId: createdOrder.id,
          seatId: seat.id,
          ticketCategoryId: categoriesByName.get(String(seat.category || '').toLowerCase())?.id || null,
          ticketNumber: `TKT-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
          category: ticketCategoryLabels[String(seat.category || 'regular').toLowerCase()] || 'Regular',
          price: seat.price,
          status: 'active',
          quota: 1,
          sold: 0,
          available: 1
        }))
        : categoryItems.flatMap(({ ticketCategory, quantity }) => Array.from({ length: quantity }, () => ({
          organizerId: concert.organizerId,
          concertId: numericConcertId,
          orderId: createdOrder.id,
          ticketCategoryId: ticketCategory.id,
          ticketNumber: `TKT-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
          category: ticketCategory.category,
          price: ticketCategory.price,
          status: 'active',
          quota: 1,
          sold: 0,
          available: 1
        })));
      await Ticket.bulkCreate(tickets, { transaction });
      if (hasSeats) {
        await Seat.update({ status: 'booked' }, {
          where: { id: selectedSeatIds, concertId: numericConcertId, status: 'available' },
          transaction
        });
      }
      await concert.update({
        availableTickets: Math.max(0, Number(concert.availableTickets || 0) - totalQuantity)
      }, { transaction });
      if (promotion) await promotion.increment('usedCount', { by: 1, transaction });
      return createdOrder;
    });

    res.status(201).json({
      success: true,
      data: order,
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(error.status || 500).json({
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

    if (status !== 'cancelled' || order.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending orders can be cancelled here' });
    }

    await sequelize.transaction(async (transaction) => {
      await order.update({ status: 'cancelled' }, { transaction });
      const tickets = await Ticket.findAll({ where: { orderId: order.id }, transaction });
      const seatIds = tickets.map((ticket) => ticket.seatId).filter(Boolean);
      if (seatIds.length) {
        await Seat.update({ status: 'available' }, { where: { id: seatIds, status: 'booked' }, transaction });
      }
      await Ticket.update({ status: 'cancelled' }, { where: { orderId: order.id, status: 'active' }, transaction });
      await Payment.update({ status: 'failed' }, { where: { orderId: order.id, status: 'pending' }, transaction });
      await Concert.increment('availableTickets', { by: tickets.length, where: { id: order.concertId }, transaction });
      if (order.promotionId) await Promotion.decrement('usedCount', { by: 1, where: { id: order.promotionId, usedCount: { [Op.gt]: 0 } }, transaction });
    });

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
    if (order.userId !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
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

    await sequelize.transaction(async (transaction) => {
      await order.update({ status: 'cancelled' }, { transaction });
      const tickets = await Ticket.findAll({ where: { orderId: order.id }, transaction });
      const seatIds = tickets.map((ticket) => ticket.seatId).filter(Boolean);
      if (seatIds.length) {
        await Seat.update({ status: 'available' }, { where: { id: seatIds, status: 'booked' }, transaction });
      }
      await Ticket.update({ status: 'cancelled' }, { where: { orderId: order.id, status: 'active' }, transaction });
      await Payment.update({ status: 'failed' }, { where: { orderId: order.id, status: 'pending' }, transaction });
      await Concert.increment('availableTickets', { by: tickets.length, where: { id: order.concertId }, transaction });
      if (order.promotionId) await Promotion.decrement('usedCount', { by: 1, where: { id: order.promotionId, usedCount: { [Op.gt]: 0 } }, transaction });
    });

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
          as: 'orderTickets',
          include: [
            { 
              model: Concert,
              as: 'concert',
              include: [
                { model: Artist, as: 'artist' },
                { model: Venue, as: 'venue' }
              ] 
            },
            { model: Seat, as: 'seat' }
          ] 
        },
        { model: Payment, as: 'orderPayment' },
        { model: Promotion, as: 'promotion' }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns the order or is admin
    if (order.userId !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
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