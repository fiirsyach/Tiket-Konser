const { User, Concert, Order, Payment, Withdrawal, OrganizerProfile, Ticket } = require('../models');
const { Op, Sequelize } = require('sequelize');

// @desc    Get Admin Dashboard
// @route   GET /api/admin/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const totalUsers = await User.count({ where: { role: 'customer' } });
    const totalOrganizers = await User.count({ where: { role: 'organizer' } });
    const pendingOrganizers = await OrganizerProfile.count({ where: { verificationStatus: 'pending' } });
    const pendingConcerts = await Concert.count({ where: { status: 'pending' } });
    const totalOrders = await Order.count();
    const totalRevenue = await Payment.sum('amount', { where: { status: 'completed' } });
    const totalTickets = await Ticket.count({ where: { status: 'active' } });

    const recentOrders = await Order.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, attributes: ['id', 'name', 'email'] },
        { model: Concert, attributes: ['id', 'name'] }
      ]
    });

    const monthlyRevenue = await Payment.findAll({
      where: {
        status: 'completed',
        paidAt: {
          [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 12))
        }
      },
      attributes: [
        [Sequelize.fn('DATE_FORMAT', Sequelize.col('paidAt'), '%Y-%m'), 'month'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
      ],
      group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('paidAt'), '%Y-%m')],
      order: [[Sequelize.fn('DATE_FORMAT', Sequelize.col('paidAt'), '%Y-%m'), 'ASC']],
      raw: true
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalOrganizers,
          pendingOrganizers,
          pendingConcerts,
          totalOrders,
          totalRevenue: totalRevenue || 0,
          totalTickets
        },
        monthlyRevenue,
        recentOrders
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get Pending Concerts
// @route   GET /api/admin/concerts/pending
exports.getPendingConcerts = async (req, res) => {
  try {
    const concerts = await Concert.findAll({
      where: { status: 'pending' },
      include: [
        { model: User, as: 'organizer', attributes: ['id', 'name', 'email'] },
        { model: OrganizerProfile, as: 'organizerProfile' },
        { model: Venue, as: 'venue' }
      ],
      order: [['createdAt', 'ASC']]
    });

    res.json({
      success: true,
      data: concerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Approve Concert
// @route   PUT /api/admin/concerts/:id/approve
exports.approveConcert = async (req, res) => {
  try {
    const concert = await Concert.findByPk(req.params.id);
    
    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    if (concert.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Concert is not pending'
      });
    }

    await concert.update({ 
      status: 'approved',
      isFeatured: req.body.isFeatured || false
    });

    // Notify organizer

    res.json({
      success: true,
      data: concert,
      message: 'Concert approved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Reject Concert
// @route   PUT /api/admin/concerts/:id/reject
exports.rejectConcert = async (req, res) => {
  try {
    const { reason } = req.body;
    const concert = await Concert.findByPk(req.params.id);
    
    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    if (concert.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Concert is not pending'
      });
    }

    await concert.update({ 
      status: 'rejected'
    });

    // Notify organizer with reason

    res.json({
      success: true,
      data: concert,
      message: 'Concert rejected'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get Organizers
// @route   GET /api/admin/organizers
exports.getOrganizers = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (status) where.verificationStatus = status;

    const organizers = await OrganizerProfile.findAndCountAll({
      where,
      include: [
        { 
          model: User, 
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone', 'status']
        }
      ],
      order: [['createdAt', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: organizers.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: organizers.count,
        totalPages: Math.ceil(organizers.count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Verify Organizer
// @route   PUT /api/admin/organizers/:id/verify
exports.verifyOrganizer = async (req, res) => {
  try {
    const profile = await OrganizerProfile.findOne({
      where: { userId: req.params.id }
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Organizer profile not found'
      });
    }

    await profile.update({ 
      verificationStatus: 'approved',
      verified: true
    });

    res.json({
      success: true,
      data: profile,
      message: 'Organizer verified successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Reject Organizer
// @route   PUT /api/admin/organizers/:id/reject
exports.rejectOrganizer = async (req, res) => {
  try {
    const { reason } = req.body;
    const profile = await OrganizerProfile.findOne({
      where: { userId: req.params.id }
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Organizer profile not found'
      });
    }

    await profile.update({ 
      verificationStatus: 'rejected'
    });

    res.json({
      success: true,
      data: profile,
      message: 'Organizer rejected'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get Orders
// @route   GET /api/admin/orders
exports.getOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (status) where.status = status;

    const orders = await Order.findAndCountAll({
      where,
      include: [
        { model: User, attributes: ['id', 'name', 'email'] },
        { model: Concert, attributes: ['id', 'name'] },
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

// @desc    Get Payments
// @route   GET /api/admin/payments
exports.getPayments = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (status) where.status = status;

    const payments = await Payment.findAndCountAll({
      where,
      include: [
        { 
          model: Order,
          include: [
            { model: User, attributes: ['id', 'name', 'email'] },
            { model: Concert, attributes: ['id', 'name'] }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: payments.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: payments.count,
        totalPages: Math.ceil(payments.count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get Refunds
// @route   GET /api/admin/refunds
exports.getRefunds = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (status) where.status = status;

    const refunds = await Order.findAndCountAll({
      where: { ...where, status: 'refunded' },
      include: [
        { model: User, attributes: ['id', 'name', 'email'] },
        { model: Concert, attributes: ['id', 'name'] },
        { model: Payment }
      ],
      order: [['updatedAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: refunds.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: refunds.count,
        totalPages: Math.ceil(refunds.count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Process Refund
// @route   PUT /api/admin/refunds/:id
exports.processRefund = async (req, res) => {
  try {
    const { action } = req.body; // 'approve' or 'reject'
    const order = await Order.findByPk(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.status !== 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Order is not in refund status'
      });
    }

    const payment = await Payment.findOne({ where: { orderId: order.id } });

    if (action === 'approve') {
      await payment.update({ 
        status: 'refunded',
        refundedAt: new Date()
      });
      
      // Update tickets
      await Ticket.update(
        { status: 'refunded' },
        { where: { orderId: order.id } }
      );

      // Update concert ticket count
      const tickets = await Ticket.findAll({ where: { orderId: order.id } });
      const concert = await Concert.findByPk(order.concertId);
      if (concert) {
        concert.soldTickets -= tickets.length;
        concert.availableTickets += tickets.length;
        await concert.save();
      }

      res.json({
        success: true,
        message: 'Refund approved'
      });
    } else {
      await order.update({ status: 'paid' });
      res.json({
        success: true,
        message: 'Refund rejected'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};