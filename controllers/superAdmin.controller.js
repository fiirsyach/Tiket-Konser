const { User, OrganizerProfile, Concert, Order, Payment, AuditLog, Venue, Category } = require('../models');
const { Op, Sequelize } = require('sequelize');

// ==================== DASHBOARD ====================
exports.getDashboard = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const totalOrganizers = await User.count({ where: { role: 'organizer' } });
    const totalConcerts = await Concert.count();
    const totalOrders = await Order.count();
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
    const payment = await Payment.findByPk(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    await payment.update({ 
      status: 'completed',
      paidAt: new Date()
    });

    await Order.update(
      { status: 'paid' },
      { where: { id: payment.orderId } }
    );

    // Create audit log
    await AuditLog.create({
      userId: req.user.id,
      action: 'CONFIRM_PAYMENT',
      entity: 'Payment',
      entityId: payment.id
    });

    res.json({
      success: true,
      data: payment,
      message: 'Payment confirmed successfully'
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
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
      case 'users':
        data = await User.findAll({
          attributes: ['id', 'name', 'email', 'role', 'status', 'createdAt']
        });
        break;
      case 'concerts':
        data = await Concert.findAll({
          attributes: ['id', 'name', 'status', 'date', 'createdAt'],
          include: [{ model: User, as: 'organizer', attributes: ['id', 'name'] }]
        });
        break;
      case 'payments':
        data = await Payment.findAll({
          attributes: ['id', 'amount', 'method', 'status', 'createdAt'],
          include: [
            { 
              model: Order,
              as: 'order',
              include: [{ model: User, as: 'user', attributes: ['id', 'name'] }]
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
        [Sequelize.literal('(SELECT COUNT(*) FROM Tickets WHERE Tickets.concertId = Concert.id)'), 'ticketCount']
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
    // Get settings from database or config
    const settings = {
      siteName: 'ConcertHub',
      siteDescription: 'Concert Ticket Booking Platform',
      currency: 'IDR',
      emailVerification: true,
      twoFactorAuth: false,
      maintenanceMode: false
    };

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

    // Save settings to database or config file
    // For now, just return success

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

// ==================== AUDIT LOG ====================
exports.getAuditLog = async (req, res) => {
  try {
    const logs = await AuditLog.findAll({
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== DATABASE BACKUP ====================
exports.backupDatabase = async (req, res) => {
  try {
    // In production, create actual database backup
    // For now, just return success

    // Log the action
    await AuditLog.create({
      userId: req.user.id,
      action: 'DATABASE_BACKUP',
      entity: 'System'
    });

    res.json({
      success: true,
      message: 'Database backup initiated successfully'
    });
  } catch (error) {
    console.error('Backup database error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};