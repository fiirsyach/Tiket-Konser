const express = require('express');
const router = express.Router();
const { protect, authorize, checkConcertOwnership } = require('../middlewares/auth');
const organizerController = require('../controllers/organizer.controller');

// All routes require authentication and organizer role
router.use(protect);
router.use(authorize('organizer'));

// Dashboard
router.get('/dashboard', organizerController.getDashboard);

// Profile
router.get('/profile', organizerController.getProfile);
router.put('/profile', organizerController.updateProfile);

// Concert Management
router.get('/concerts', organizerController.getConcerts);
router.get('/concerts/:id', organizerController.getConcertById);
router.post('/concerts', organizerController.createConcert);
router.put('/concerts/:id', checkConcertOwnership, organizerController.updateConcert);
router.delete('/concerts/:id', checkConcertOwnership, organizerController.deleteConcert);
router.post('/concerts/:id/submit', organizerController.submitConcertForApproval);
router.post('/concerts/:id/publish', checkConcertOwnership, organizerController.publishConcert);
router.post('/concerts/:id/unpublish', checkConcertOwnership, organizerController.unpublishConcert);

// Seat Management - Organizer only
router.get('/concerts/:id/seat-editor', checkConcertOwnership, organizerController.getSeatEditor);
router.put('/concerts/:id/seat-config', checkConcertOwnership, organizerController.updateSeatConfig);

// Ticket Management
router.get('/tickets', organizerController.getTickets);
router.post('/tickets', organizerController.createTicket);
router.put('/tickets/:id', organizerController.updateTicket);
router.delete('/tickets/:id', organizerController.deleteTicket);

// Seat Layout
router.get('/seats', organizerController.getSeats);
router.post('/seats', organizerController.createSeat);
router.put('/seats/:id', organizerController.updateSeat);
router.delete('/seats/:id', organizerController.deleteSeat);

// Gallery
router.get('/gallery', organizerController.getGallery);
router.post('/gallery', organizerController.uploadGallery);
router.delete('/gallery/:id', organizerController.deleteGallery);

router.get('/venues', organizerController.getOrganizerVenues);
router.post('/venues', organizerController.createOrganizerVenue);
router.put('/venues/:id', organizerController.updateOrganizerVenue);
router.delete('/venues/:id', organizerController.deleteOrganizerVenue);

// Promo
router.get('/promos', organizerController.getPromos);
router.post('/promos', organizerController.createPromo);
router.put('/promos/:id', organizerController.updatePromo);
router.delete('/promos/:id', organizerController.deletePromo);

// Orders
router.get('/orders', organizerController.getOrders);
router.get('/orders/:id', organizerController.getOrderDetail);

// Revenue
router.get('/revenue', organizerController.getRevenue);

// Analytics
router.get('/analytics', organizerController.getAnalytics);

// Withdrawal
router.post('/withdraw', organizerController.requestWithdrawal);
router.get('/withdrawals', organizerController.getWithdrawals);
router.put('/withdrawals/:id/cancel', organizerController.cancelWithdrawal);

module.exports = router;