const express = require('express');
const router = express.Router();
const { 
  getConcerts, 
  getConcert, 
  createConcert, 
  updateConcert, 
  deleteConcert,
  getFeaturedConcerts,
  getUpcomingConcerts,
  getConcertsByArtist,
  searchConcerts,
  getFlashSaleConcerts,
  getConcertSeats,
  bookSeat,
  getPublishedConcerts
} = require('../controllers/concert.controller');
const { protect, authorize } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');

// ============ PUBLIC ROUTES ============
// List dan search
router.get('/', getPublishedConcerts);
router.get('/featured', getFeaturedConcerts);
router.get('/upcoming', getUpcomingConcerts);
router.get('/flash-sale', getFlashSaleConcerts);
router.get('/search', searchConcerts);
router.get('/artist/:artistId', getConcertsByArtist);
router.get('/:id/reviews', require('../controllers/concert.controller').getConcertReviews);

// Detail concert by ID - HARUS di bawah route yang spesifik
router.get('/:id', getConcert);
// Route untuk get seats
router.get('/:id/seats', getConcertSeats);

// ============ PROTECTED ROUTES ============
router.post('/:id/book', protect, bookSeat);

// ============ ADMIN ROUTES ============
router.post('/', protect, authorize('admin', 'super_admin'), upload.fields([{ name: 'thumbnail' }, { name: 'banner' }]), createConcert);
router.put('/:id', protect, authorize('admin', 'super_admin'), upload.fields([{ name: 'thumbnail' }, { name: 'banner' }]), updateConcert);
router.delete('/:id', protect, authorize('admin', 'super_admin'), deleteConcert);

module.exports = router;