const express = require('express');
const router = express.Router();
const { 
  createPayment, 
  processPayment,
  getPaymentStatus,
  handlePaymentCallback,
  getPaymentMethods,
  refundPayment
} = require('../controllers/payment.controller');
const { protect, authorize } = require('../middlewares/auth');

// Public routes
router.get('/methods', getPaymentMethods);

// Protected routes
router.post('/create', protect, createPayment);
router.get('/:id/status', protect, getPaymentStatus);
router.post('/:id/process', protect, processPayment);

// Callback (webhook)
router.post('/callback', handlePaymentCallback);

// Admin routes
router.post('/:id/refund', protect, authorize('admin', 'super_admin'), refundPayment);

module.exports = router;