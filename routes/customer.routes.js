const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const customerController = require('../controllers/customer.controller');

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

// Tickets
router.get('/tickets', customerController.getTickets);
router.get('/tickets/:id', customerController.getTicketById);

// Favorites & Wishlist
router.get('/favorites', customerController.getFavorites);
router.post('/favorites/:concertId', customerController.addFavorite);
router.delete('/favorites/:concertId', customerController.removeFavorite);
router.get('/wishlist', customerController.getWishlist);

// Reviews
router.post('/reviews', customerController.createReview);
router.get('/reviews', customerController.getReviews);

module.exports = router;