const express = require('express');
const router = express.Router();
const { 
  getUsers, 
  getUser, 
  updateUser, 
  deleteUser,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  getNotifications,
  markNotificationRead,
  deleteNotification
} = require('../controllers/user.controller');
const { protect, authorize } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');

// Protected routes
router.get('/me', protect, getUser);
router.put('/me', protect, upload.single('avatar'), updateUser);
router.get('/wishlist', protect, getWishlist);
router.post('/wishlist/:concertId', protect, addToWishlist);
router.delete('/wishlist/:concertId', protect, removeFromWishlist);
router.get('/notifications', protect, getNotifications);
router.put('/notifications/:id/read', protect, markNotificationRead);
router.delete('/notifications/:id', protect, deleteNotification);

// Admin routes
router.get('/', protect, authorize('admin', 'super_admin'), getUsers);
router.get('/:id', protect, authorize('admin', 'super_admin'), getUser);
router.put('/:id', protect, authorize('admin', 'super_admin'), updateUser);
router.delete('/:id', protect, authorize('admin', 'super_admin'), deleteUser);

module.exports = router;