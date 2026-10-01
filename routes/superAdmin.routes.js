const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const superAdminController = require('../controllers/superAdmin.controller');
const venueController = require('../controllers/venue.controller');
const paymentController = require('../controllers/payment.controller');
const { upload } = require('../middlewares/upload');

router.use(protect);
router.use(authorize('super_admin'));

// Dashboard
router.get('/dashboard', superAdminController.getDashboard);

// User Management
router.get('/users', superAdminController.getUsers);
router.get('/users/:id', superAdminController.getUserById);
router.put('/users/:id', superAdminController.updateUser);
router.delete('/users/:id', superAdminController.deleteUser);
router.put('/users/:id/block', superAdminController.blockUser);
router.put('/users/:id/unblock', superAdminController.unblockUser);

// Organizer Management
router.get('/organizers', superAdminController.getOrganizers);
router.put('/organizers/:id/verify', superAdminController.verifyOrganizer);
router.put('/organizers/:id/reject', superAdminController.rejectOrganizer);

// Concert Management
router.get('/concerts', superAdminController.getConcerts);
router.put('/concerts/:id/approve', superAdminController.approveConcert);
router.put('/concerts/:id/reject', superAdminController.rejectConcert);
router.delete('/concerts/:id', superAdminController.deleteConcert);

// Payment Management
router.get('/payments', superAdminController.getPayments);
router.put('/payments/:id/confirm', superAdminController.confirmPayment);
router.post('/payments/:id/refund', paymentController.refundPayment);

// Category management
router.get('/categories', superAdminController.getCategories);
router.post('/categories', superAdminController.createCategory);
router.put('/categories/:id', superAdminController.updateCategory);
router.delete('/categories/:id', superAdminController.deleteCategory);

// Venue management
router.get('/venues', venueController.getVenues);
router.post('/venues', upload.single('image'), venueController.createVenue);
router.put('/venues/:id', upload.single('image'), venueController.updateVenue);
router.delete('/venues/:id', venueController.deleteVenue);

// Withdrawal processing
router.get('/withdrawals', superAdminController.getWithdrawals);
router.put('/withdrawals/:id/approve', superAdminController.approveWithdrawal);
router.put('/withdrawals/:id/reject', superAdminController.rejectWithdrawal);
router.put('/withdrawals/:id/complete', superAdminController.completeWithdrawal);

// Reports
router.get('/reports', superAdminController.getReports);

// Analytics
router.get('/analytics', superAdminController.getAnalytics);

// System Settings
router.get('/system', superAdminController.getSystemSettings);
router.put('/system', superAdminController.updateSystemSettings);

// Audit Log
router.get('/audit-log', superAdminController.getAuditLog);

// Database Backup
router.post('/backup', superAdminController.backupDatabase);

module.exports = router;