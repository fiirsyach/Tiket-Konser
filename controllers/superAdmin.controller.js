const { User, OrganizerProfile, Concert, Order, Payment, Ticket, TicketCategory, AuditLog, Venue, Category, SystemSetting, Seat, sequelize } = require('../models');
const { Op, Sequelize } = require('sequelize');
const { ensureTicketQr } = require('../utils/ticketQr');

const parseSettingValue = (record) => {
  if (record.type === 'json') return JSON.parse(record.value);
  if (record.type === 'number') return Number(record.value);
  if (record.type === 'boolean') return record.value === 'true';
  return record.value;
};

// ==================== DASHBOARD ====================
exports.getDashboard = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const totalOrganizers = await User.count({ where: { role: 'organizer' } });
    const totalConcerts = await Concert.count();
    const totalOrders = await Order.count();
    const totalPayments = await Payment.count();
    const totalRevenue = await Payment.sum('amount', { where: { status: 'completed' } });
    const pendingOrganizers = await OrganizerProfile.count({ where: { verificationStatus: 'pending' } });
    const pendingConcerts = await Concert.count({ where: { status: 'pending' } });

    // Recent activities
    const recentUsers = await User.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'name', 'email', 'role', 'createdAt']
    });

    const recentOrders = await Order.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'user', attributes: ['id', 'name'] },
        { model: Concert, as: 'concert', attributes: ['id', 'name'] }
      ]
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalOrganizers,
          totalConcerts,
          totalOrders,
          totalPayments,
          totalRevenue: totalRevenue || 0,
          pendingOrganizers,
          pendingConcerts
        },
        recentUsers,
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

// ==================== USER MANAGEMENT ====================
exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password', 'refreshToken', 'resetPasswordToken', 'resetPasswordExpire'] },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password', 'refreshToken', 'resetPasswordToken', 'resetPasswordExpire'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user by id error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, email, phone, role, status } = req.body;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.update({ name, email, phone, role, status });

    // Create audit log
    await AuditLog.create({
      userId: req.user.id,
      action: 'UPDATE_USER',
      entity: 'User',
      entityId: user.id,
      newData: { name, email, phone, role, status }
    });

    res.json({
      success: true,
      data: user,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete super admin'
      });
    }

    await user.destroy();

    // Create audit log
    await AuditLog.create({
      userId: req.user.id,
      action: 'DELETE_USER',
      entity: 'User',
      entityId: user.id
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== ORGANIZER MANAGEMENT ====================
exports.getOrganizers = async (req, res) => {
  try {
    const organizers = await OrganizerProfile.findAll({
      include: [
        { 
          model: User, 
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone', 'status', 'createdAt']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: organizers
    });
  } catch (error) {
    console.error('❌ Get organizers error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.verifyOrganizer = async (req, res) => {
  try {
    const userId = req.params.id;
    console.log('🔍 Verifying organizer with userId:', userId);

    // Cari profile organizer
    const profile = await OrganizerProfile.findOne({
      where: { userId: userId }
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Organizer profile not found'
      });
    }

    // Update profile
    await profile.update({ 
      verificationStatus: 'approved',
      verified: true
    });

    // Update user status
    await User.update(
      { status: 'active' },
      { where: { id: userId } }
    );

    console.log('✅ Organizer verified:', userId);

    // Create audit log
    await AuditLog.create({
      userId: req.user.id,
      action: 'VERIFY_ORGANIZER',
      entity: 'OrganizerProfile',
      entityId: profile.id,
      newData: { verificationStatus: 'approved', verified: true }
    });

    res.json({
      success: true,
      data: profile,
      message: 'Organizer verified successfully'
    });
  } catch (error) {
    console.error('❌ Verify organizer error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.rejectOrganizer = async (req, res) => {
  try {
    const userId = req.params.id;
    const { reason } = req.body;
    console.log('🔍 Rejecting organizer with userId:', userId);
    console.log('📝 Reason:', reason);

    // Cari profile organizer
    const profile = await OrganizerProfile.findOne({
      where: { userId: userId }
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Organizer profile not found'
      });
    }

    // Update profile
    await profile.update({ 
      verificationStatus: 'rejected',
      verified: false
    });

    // Update user status
    await User.update(
      { status: 'inactive' },
      { where: { id: userId } }
    );

    console.log('✅ Organizer rejected:', userId);

    // Create audit log
    await AuditLog.create({
      userId: req.user.id,
      action: 'REJECT_ORGANIZER',
      entity: 'OrganizerProfile',
      entityId: profile.id,
      newData: { verificationStatus: 'rejected', reason: reason || 'No reason provided' }
    });

    res.json({
      success: true,
      data: profile,
      message: 'Organizer rejected successfully'
    });
  } catch (error) {
    console.error('❌ Reject organizer error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== CONCERT MANAGEMENT ====================
exports.getConcerts = async (req, res) => {
  try {
    const concerts = await Concert.findAll({
      include: [
        { model: User, as: 'organizer', attributes: ['id', 'name', 'email'] },
        { model: Venue, as: 'venue' },
        { model: Category, as: 'category' }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: concerts
    });
  } catch (error) {
    console.error('Get concerts error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

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
      return res.status(400).json({ success: false, message: 'Only pending concerts can be approved' });
    }

    await concert.update({ 
      status: 'approved'
    });

    // Create audit log
    await AuditLog.create({
      userId: req.user.id,
      action: 'APPROVE_CONCERT',
      entity: 'Concert',
      entityId: concert.id
    });

    res.json({
      success: true,
      data: concert,
      message: 'Concert approved successfully'
    });
  } catch (error) {
    console.error('Approve concert error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.rejectConcert = async (req, res) => {
  try {
    const concert = await Concert.findByPk(req.params.id);

    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    if (concert.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending concerts can be rejected' });
    }

    await concert.update({ 
      status: 'rejected'
    });

    // Create audit log
    await AuditLog.create({
      userId: req.user.id,
      action: 'REJECT_CONCERT',
      entity: 'Concert',
      entityId: concert.id
    });

    res.json({
      success: true,
      data: concert,
      message: 'Concert rejected'
    });
  } catch (error) {
    console.error('Reject concert error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.deleteConcert = async (req, res) => {
  try {
    const concert = await Concert.findByPk(req.params.id);

    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    await concert.destroy();

    // Create audit log
    await AuditLog.create({
      userId: req.user.id,
      action: 'DELETE_CONCERT',
      entity: 'Concert',
      entityId: concert.id
    });

    res.json({
      success: true,
      message: 'Concert deleted successfully'
    });
  } catch (error) {
    console.error('Delete concert error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== PAYMENT MANAGEMENT ====================
exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.findAll({
      include: [
        { 
          model: Order,
          as: 'order',
          include: [
            { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
            { model: Concert, as: 'concert', attributes: ['id', 'name'] }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.confirmPayment = async (req, res) => {
  try {
    const paymentSummary = await Payment.findByPk(req.params.id, { attributes: ['id', 'orderId'] });
    if (!paymentSummary) return res.status(404).json({ success: false, message: 'Payment not found' });

    const orderId = paymentSummary.orderId;
    const confirmedPayment = await sequelize.transaction(async (transaction) => {
      const order = await Order.findByPk(orderId, { transaction, lock: transaction.LOCK.UPDATE });
      const payment = await Payment.findByPk(paymentSummary.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!order || order.status !== 'pending' || (order.expiryDate && order.expiryDate <= new Date())) {
        const error = new Error('Order is no longer payable');
        error.status = 409;
        throw error;
      }
      if (!payment || payment.status !== 'pending') {
        const error = new Error('Payment is not pending');
        error.status = 409;
        throw error;
      }

      const tickets = await Ticket.findAll({ where: { orderId, status: 'active' }, transaction });
      await payment.update({ status: 'completed', paidAt: new Date() }, { transaction });
      await order.update({ status: 'paid', paymentDate: new Date() }, { transaction });
      await Concert.increment('soldTickets', { by: tickets.length, where: { id: order.concertId }, transaction });

      const categoryCounts = new Map();
      tickets.forEach((ticket) => {
        if (ticket.ticketCategoryId) categoryCounts.set(ticket.ticketCategoryId, (categoryCounts.get(ticket.ticketCategoryId) || 0) + 1);
      });
      for (const [categoryId, quantity] of categoryCounts) {
        await TicketCategory.increment('sold', { by: quantity, where: { id: categoryId }, transaction });
      }
      return payment;
    });

    const tickets = await Ticket.findAll({
      where: { orderId, status: 'active' },
      include: [{ model: Seat, as: 'seat' }]
    });
    for (const ticket of tickets) {
      await ensureTicketQr(ticket);
    }

    // Create audit log
    await AuditLog.create({
      userId: req.user.id,
      action: 'CONFIRM_PAYMENT',
      entity: 'Payment',
      entityId: confirmedPayment.id
    });

    res.json({
      success: true,
      data: confirmedPayment,
      message: 'Payment confirmed successfully'
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== REPORTS ====================
exports.getReports = async (req, res) => {
  try {
    const { type = 'overview' } = req.query;

    let data = {};

    switch (type) {
      case 'overview':
        data = {
          totalUsers: await User.count(),
          totalOrganizers: await User.count({ where: { role: 'organizer' } }),
          totalConcerts: await Concert.count(),
          totalOrders: await Order.count(),
          totalRevenue: await Payment.sum('amount', { where: { status: 'completed' } })
        };
        break;
      case 'payments':
        data = await Payment.findAll({
          attributes: ['id', 'amount', 'method', 'status', 'createdAt', 'refundAmount'],
          include: [
            { 
              model: Order,
              as: 'order',
              include: [
                { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
                { model: Concert, as: 'concert', attributes: ['id', 'name'] }
              ]
            }
          ]
        });
        break;
      default:
        data = { message: 'Invalid report type' };
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== ANALYTICS ====================
exports.getAnalytics = async (req, res) => {
  try {
    // Monthly revenue (last 6 months)
    const monthlyRevenue = await Payment.findAll({
      where: {
        status: 'completed',
        paidAt: {
          [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 6))
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

    // User growth (last 6 months)
    const userGrowth = await User.findAll({
      attributes: [
        [Sequelize.fn('DATE_FORMAT', Sequelize.col('createdAt'), '%Y-%m'), 'month'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('createdAt'), '%Y-%m')],
      order: [[Sequelize.fn('DATE_FORMAT', Sequelize.col('createdAt'), '%Y-%m'), 'ASC']],
      raw: true,
      limit: 6
    });

    // Top concerts by ticket sales
    const topConcerts = await Concert.findAll({
      attributes: [
        'id',
        'name',
        [Sequelize.literal("(SELECT COUNT(*) FROM Tickets WHERE Tickets.concertId = Concert.id AND Tickets.status IN ('active', 'used'))"), 'ticketCount']
      ],
      order: [[Sequelize.literal('ticketCount'), 'DESC']],
      limit: 5
    });

    res.json({
      success: true,
      data: {
        monthlyRevenue,
        userGrowth,
        topConcerts
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== SYSTEM SETTINGS ====================
exports.getSystemSettings = async (req, res) => {
  try {
    const records = await SystemSetting.findAll();
    const settings = Object.fromEntries(records.map((record) => [record.key, parseSettingValue(record)]));

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateSystemSettings = async (req, res) => {
  try {
    const settings = req.body;
    if (!settings || Array.isArray(settings) || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Settings must be an object' });
    }

    for (const [key, value] of Object.entries(settings)) {
      const type = value === null || typeof value === 'string'
        ? 'string'
        : typeof value === 'number'
          ? 'number'
          : typeof value === 'boolean'
            ? 'boolean'
            : 'json';
      const serializedValue = type === 'json' ? JSON.stringify(value) : String(value);
      const [record, created] = await SystemSetting.findOrCreate({
        where: { key },
        defaults: { category: 'general', type, value: serializedValue }
      });
      if (!created) await record.update({ type, value: serializedValue });
    }

    // Create audit log
    await AuditLog.create({
      userId: req.user.id,
      action: 'UPDATE_SYSTEM_SETTINGS',
      entity: 'System',
      newData: settings
    });

    res.json({
      success: true,
      data: settings,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Update system settings error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'super_admin') return res.status(403).json({ success: false, message: 'Cannot block a super admin' });
    await user.update({ status: 'blocked' });
    await AuditLog.create({ userId: req.user.id, action: 'BLOCK_USER', entity: 'User', entityId: user.id });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'super_admin') return res.status(403).json({ success: false, message: 'Super admin status cannot be changed here' });
    await user.update({ status: 'active' });
    await AuditLog.create({ userId: req.user.id, action: 'UNBLOCK_USER', entity: 'User', entityId: user.id });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
