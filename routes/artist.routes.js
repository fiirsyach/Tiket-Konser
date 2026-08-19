const express = require('express');
const router = express.Router();
const { 
  getArtists, 
  getArtist, 
  createArtist, 
  updateArtist, 
  deleteArtist,
  getFeaturedArtists,
  searchArtists
} = require('../controllers/artist.controller');
const { protect, authorize } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');

// Public routes
router.get('/', getArtists);
router.get('/featured', getFeaturedArtists);
router.get('/search', searchArtists);
router.get('/:id', getArtist);

// Admin routes
router.post('/', protect, authorize('admin', 'super_admin'), upload.single('photo'), createArtist);
router.put('/:id', protect, authorize('admin', 'super_admin'), upload.single('photo'), updateArtist);
router.delete('/:id', protect, authorize('admin', 'super_admin'), deleteArtist);

module.exports = router;