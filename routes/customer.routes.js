const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const customerController = require('../controllers/customer.controller');
const { upload } = require('../middlewares/upload');

// All routes require authentication and customer role
router.use(protect);
router.use(authorize('customer'));

// Dashboard
router.get('/dashboard', customerController.getDashboard);

// Profile
router.get('/profile', customerController.getProfile);
router.put('/profile', customerController.updateProfile);

// Orders
router.get('/orders', customerController.getOrders);
router.get('/orders/:id', customerController.getOrderById);
router.get('/orders/:id/pdf', customerController.downloadOrderTicketsPdf);

// Tickets
router.get('/tickets', customerController.getTickets);
router.get('/tickets/:id', customerController.getTicketById);
router.get('/tickets/:id/qr', customerController.getTicketQr);
router.get('/tickets/:id/pdf', customerController.downloadTicketPdf);

// Favorites & Wishlist
router.get('/favorites', customerController.getFavorites);
router.post('/favorites/:concertId', customerController.addFavorite);
router.delete('/favorites/:concertId', customerController.removeFavorite);
router.get('/wishlist', customerController.getWishlist);

// Reviews
router.post('/reviews', upload.array('images', 5), customerController.createReview);
router.put('/reviews/:id', upload.array('images', 5), customerController.updateReview);
router.delete('/reviews/:id', customerController.deleteReview);
router.get('/reviews', customerController.getReviews);

module.exports = router;