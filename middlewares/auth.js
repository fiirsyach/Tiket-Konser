const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Protect routes - Authentication
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] }
    });

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (req.user.status === 'blocked') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked'
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// Authorize roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Check if organizer owns the concert
const checkConcertOwnership = async (req, res, next) => {
  try {
    const { Concert } = require('../models');
    const concert = await Concert.findByPk(req.params.id);
    
    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    if (concert.organizerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage your own concerts'
      });
    }

    req.concert = concert;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Check if user is the organizer of the concert
const isOrganizer = async (req, res, next) => {
  try {
    const { Concert } = require('../models');
    const concert = await Concert.findByPk(req.params.id);
    
    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    if (concert.organizerId === req.user.id) {
      req.concert = concert;
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: 'You are not the organizer of this concert'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = { protect, authorize, checkConcertOwnership, isOrganizer };