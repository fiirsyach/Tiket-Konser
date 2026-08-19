const express = require('express');
const router = express.Router();
const { 
  getOrders, 
  getOrder, 
  createOrder, 
  updateOrderStatus,
  cancelOrder,
  getMyOrders,
  getOrderInvoice
} = require('../controllers/order.controller');
const { protect, authorize } = require('../middlewares/auth');

// Protected routes
router.get('/my-orders', protect, getMyOrders);
router.post('/', protect, createOrder);
router.get('/:id', protect, getOrder);
router.get('/:id/invoice', protect, getOrderInvoice);
router.put('/:id/cancel', protect, cancelOrder);

// Admin routes
router.get('/', protect, authorize('admin', 'super_admin'), getOrders);
router.put('/:id/status', protect, authorize('admin', 'super_admin'), updateOrderStatus);

module.exports = router;