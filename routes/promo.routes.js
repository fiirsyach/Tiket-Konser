const express = require('express');
const router = express.Router();
const { 
  getPromotions, 
  getPromotion, 
  createPromotion, 
  updatePromotion, 
  deletePromotion,
  validatePromoCode,
  getActivePromotions
} = require('../controllers/promo.controller');
const { protect, authorize } = require('../middlewares/auth');

// Public routes
router.get('/', getPromotions);
router.get('/active', getActivePromotions);
router.get('/validate', protect, validatePromoCode);
router.get('/:id', getPromotion);

// Admin routes
router.post('/', protect, authorize('admin', 'super_admin'), createPromotion);
router.put('/:id', protect, authorize('admin', 'super_admin'), updatePromotion);
router.delete('/:id', protect, authorize('admin', 'super_admin'), deletePromotion);

module.exports = router;