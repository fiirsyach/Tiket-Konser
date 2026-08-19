const { User, OrganizerProfile } = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Op } = require('sequelize');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Generate Refresh Token
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register Customer
// @route   POST /api/auth/register/customer
exports.registerCustomer = async (req, res) => {
  try {
    console.log('📝 Register Customer Request:', req.body);
    
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone: phone || null,
      role: 'customer',
      status: 'active',
      isVerified: true
    });

    console.log('✅ Customer created:', user.id, user.email);

    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('❌ Register Customer Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Register Organizer
// @route   POST /api/auth/register/organizer
exports.registerOrganizer = async (req, res) => {
  try {
    console.log('📝 Register Organizer Request:', req.body);
    
    const { 
      name, 
      email, 
      password, 
      phone,
      companyName,
      description,
      website,
      instagram,
      youtube,
      city,
      address,
      bankName,
      bankAccount,
      bankHolder
    } = req.body;

    // Validasi input dasar
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    // Validasi khusus organizer
    if (!companyName) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }

    if (!city) {
      return res.status(400).json({
        success: false,
        message: 'City is required'
      });
    }

    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Address is required'
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Create user with organizer role
    const user = await User.create({
      name,
      email,
      password,
      phone: phone || null,
      role: 'organizer',
      status: 'active',
      isVerified: true
    });

    console.log('✅ User created:', user.id);

    // Create organizer profile
    const organizerProfile = await OrganizerProfile.create({
      userId: user.id,
      companyName: companyName.trim(),
      description: description || null,
      website: website || null,
      instagram: instagram || null,
      youtube: youtube || null,
      city: city.trim(),
      address: address.trim(),
      bankName: bankName || null,
      bankAccount: bankAccount || null,
      bankHolder: bankHolder || null,
      verificationStatus: 'pending'
    });

    console.log('✅ Organizer profile created:', organizerProfile.id);

    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      },
      organizerProfile
    });
  } catch (error) {
    console.error('❌ Register Organizer Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Login
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    console.log('🔐 Login Request:', req.body.email);
    
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Cari user
    const user = await User.findOne({ where: { email } });
    console.log('📧 User found:', user ? user.email : 'NOT FOUND');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials - User not found'
      });
    }

    // Cek status
    if (user.status === 'blocked') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked'
      });
    }

    // Cek password - PASTIKAN MENGGUNAKAN comparePassword
    const isMatch = await user.comparePassword(password);
    console.log('🔑 Password match:', isMatch);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials - Wrong password'
      });
    }

    // Cek role dan verifikasi organizer
    if (user.role === 'organizer') {
      const profile = await OrganizerProfile.findOne({ where: { userId: user.id } });
      if (profile && profile.verificationStatus !== 'approved') {
        return res.status(403).json({
          success: false,
          message: `Your organizer account is ${profile.verificationStatus}. Please wait for verification.`
        });
      }
    }

    const token = generateToken(user.id);
    user.lastLogin = new Date();
    await user.save();

    console.log('✅ Login success for:', user.email);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('❌ Login Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Refresh Token
// @route   POST /api/auth/refresh-token
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const newToken = generateToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = resetPasswordExpire;
    await user.save();

    // Send email with reset token (implement email service)
    res.json({
      success: true,
      message: 'Password reset token sent',
      resetToken
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    const user = await User.findOne({
      where: {
        resetPasswordToken: resetToken,
        resetPasswordExpire: { [Op.gt]: Date.now() }
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Logout
// @route   POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    user.refreshToken = null;
    await user.save();

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get Current User
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'refreshToken', 'resetPasswordToken', 'resetPasswordExpire'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If organizer, get profile
    let organizerProfile = null;
    if (user.role === 'organizer') {
      organizerProfile = await OrganizerProfile.findOne({ where: { userId: user.id } });
    }

    res.json({
      success: true,
      user,
      organizerProfile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};