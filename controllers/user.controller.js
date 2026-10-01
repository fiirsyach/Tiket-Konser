const { User, Favorite, Concert, Venue, Artist, Notification } = require('../models');
const { Op } = require('sequelize');

const sanitizeUser = (user) => {
  if (!user) return null;
  const plain = user.toJSON ? user.toJSON() : user;
  delete plain.password;
  delete plain.refreshToken;
  delete plain.resetPasswordToken;
  delete plain.resetPasswordExpire;
  return plain;
};

// @desc    Get all users (for Super Admin)
// @route   GET /api/super-admin/users
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
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
exports.getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findByPk(userId, {
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
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getUser = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;

    if (req.params.id && req.user.id !== Number(userId) && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to access this profile'
      });
    }

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password', 'refreshToken', 'resetPasswordToken', 'resetPasswordExpire'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      data: sanitizeUser(user)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;

    if (req.params.id && req.user.id !== Number(userId) && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to update this user'
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { name, email, phone, avatar, role, status, password } = req.body;
    const updatePayload = {};

    if (name !== undefined) updatePayload.name = name;
    if (email !== undefined) updatePayload.email = email;
    if (phone !== undefined) updatePayload.phone = phone;
    if (avatar !== undefined) updatePayload.avatar = avatar;
    if (password !== undefined && password) updatePayload.password = password;

    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      if (role !== undefined) updatePayload.role = role;
      if (status !== undefined) updatePayload.status = status;
    }

    await user.update(updatePayload);

    return res.json({
      success: true,
      data: sanitizeUser(user),
      message: 'User updated successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.destroy();

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Wishlist
exports.getWishlist = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    const wishlist = await Favorite.findAll({
      where: { userId },
      include: [
        {
          model: Concert,
          as: 'concert',
          include: [
            { model: Venue, as: 'venue' },
            { model: Artist, as: 'artist' }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.json({
      success: true,
      data: wishlist
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch wishlist'
    });
  }
};

exports.addToWishlist = async (req, res) => {
  try {
    const { concertId } = req.params;
    if (!concertId) {
      return res.status(400).json({
        success: false,
        message: 'Concert ID is required'
      });
    }

    const concert = await Concert.findByPk(concertId);
    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    const existing = await Favorite.findOne({
      where: { userId: req.user.id, concertId }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Concert already in wishlist'
      });
    }

    const favorite = await Favorite.create({
      userId: req.user.id,
      concertId
    });

    return res.status(201).json({
      success: true,
      data: favorite,
      message: 'Added to wishlist'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to add wishlist item'
    });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const { concertId } = req.params;
    const favorite = await Favorite.findOne({
      where: { userId: req.user.id, concertId }
    });

    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: 'Favorite not found'
      });
    }

    await favorite.destroy();

    return res.json({
      success: true,
      message: 'Removed from wishlist'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to remove wishlist item'
    });
  }
};

// Notifications
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    return res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch notifications'
    });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    if (notification.userId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Not allowed to update this notification'
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return res.json({
      success: true,
      data: notification,
      message: 'Notification marked as read'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update notification'
    });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    if (notification.userId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Not allowed to delete this notification'
      });
    }

    await notification.destroy();

    return res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete notification'
    });
  }
};