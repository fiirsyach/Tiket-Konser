// routes/venue.routes.js
const express = require('express');
const router = express.Router();
const { 
  getVenues, 
  getVenue, 
  createVenue, 
  updateVenue, 
  deleteVenue,
  getVenueTypes,
  generateSeatLayout,
  getVenueSeats
} = require('../controllers/venue.controller');
const { protect, authorize } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');

// ==================== PUBLIC ROUTES ====================
// Semua user bisa melihat venue
router.get('/', getVenues);
router.get('/types', getVenueTypes);
router.get('/:id', getVenue);
router.get('/:id/seats', getVenueSeats);
router.post('/generate-layout', generateSeatLayout);

// ==================== PROTECTED ROUTES ====================
// Hanya admin, super_admin, dan organizer yang bisa manage venue
router.post('/', protect, authorize('admin', 'super_admin', 'organizer'), upload.single('image'), createVenue);
router.put('/:id', protect, authorize('admin', 'super_admin', 'organizer'), upload.single('image'), updateVenue);
router.delete('/:id', protect, authorize('admin', 'super_admin', 'organizer'), deleteVenue);

module.exports = router;