const { body, validationResult } = require('express-validator');

// Validation result handler
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// Register validation
const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone')
    .optional()
    .trim()
    .isLength({ min: 10, max: 15 }).withMessage('Phone number must be between 10 and 15 characters'),
  validate
];

// Login validation
const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email'),
  body('password')
    .notEmpty().withMessage('Password is required'),
  validate
];

// Concert validation
const validateConcert = [
  body('name')
    .trim()
    .notEmpty().withMessage('Concert name is required')
    .isLength({ max: 200 }).withMessage('Concert name must be less than 200 characters'),
  body('date')
    .notEmpty().withMessage('Date is required')
    .isISO8601().withMessage('Invalid date format'),
  body('time')
    .notEmpty().withMessage('Time is required'),
  body('VenueId')
    .notEmpty().withMessage('Venue is required')
    .isInt().withMessage('Invalid venue ID'),
  body('ArtistId')
    .notEmpty().withMessage('Artist is required')
    .isInt().withMessage('Invalid artist ID'),
  validate
];

// Order validation
const validateOrder = [
  body('concertId')
    .notEmpty().withMessage('Concert ID is required')
    .isInt().withMessage('Invalid concert ID'),
  body('seats')
    .isArray().withMessage('Seats must be an array')
    .notEmpty().withMessage('At least one seat is required'),
  body('seats.*')
    .isInt().withMessage('Invalid seat ID'),
  validate
];

// Payment validation
const validatePayment = [
  body('orderId')
    .notEmpty().withMessage('Order ID is required')
    .isInt().withMessage('Invalid order ID'),
  body('method')
    .trim()
    .notEmpty().withMessage('Payment method is required')
    .isIn(['qris', 'bca_va', 'mandiri_va', 'bni_va', 'ovo', 'gopay', 'shopeepay', 'dana'])
    .withMessage('Invalid payment method'),
  validate
];

// Promotion validation
const validatePromotion = [
  body('code')
    .trim()
    .notEmpty().withMessage('Promo code is required')
    .isLength({ min: 3, max: 50 }).withMessage('Promo code must be between 3 and 50 characters'),
  body('name')
    .trim()
    .notEmpty().withMessage('Promotion name is required')
    .isLength({ max: 100 }).withMessage('Promotion name must be less than 100 characters'),
  body('type')
    .trim()
    .notEmpty().withMessage('Promotion type is required')
    .isIn(['voucher', 'discount', 'flash_sale', 'bundle'])
    .withMessage('Invalid promotion type'),
  body('value')
    .notEmpty().withMessage('Value is required')
    .isFloat({ min: 0 }).withMessage('Value must be a positive number'),
  body('startDate')
    .notEmpty().withMessage('Start date is required')
    .isISO8601().withMessage('Invalid start date format'),
  body('endDate')
    .notEmpty().withMessage('End date is required')
    .isISO8601().withMessage('Invalid end date format')
    .custom((endDate, { req }) => {
      if (new Date(endDate) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  validate
];

module.exports = {
  validate,
  validateRegister,
  validateLogin,
  validateConcert,
  validateOrder,
  validatePayment,
  validatePromotion
};