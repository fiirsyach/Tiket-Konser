const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const adminController = require('../controllers/admin.controller');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin', 'super_admin'));

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Concert Management
router.get('/concerts/pending', adminController.getPendingConcerts);
router.put('/concerts/:id/approve', adminController.approveConcert);
router.put('/concerts/:id/reject', adminController.rejectConcert);

// Organizer Management
router.get('/organizers', adminController.getOrganizers);
router.put('/organizers/:id/verify', adminController.verifyOrganizer);
router.put('/organizers/:id/reject', adminController.rejectOrganizer);

// Orders & Payments
router.get('/orders', adminController.getOrders);
router.get('/payments', adminController.getPayments);
router.get('/refunds', adminController.getRefunds);
router.put('/refunds/:id', adminController.processRefund);

module.exports = router;