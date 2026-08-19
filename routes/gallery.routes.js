// routes/gallery.routes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const galleryController = require('../controllers/gallery.controller');

// ============ PUBLIC ROUTES ============
router.get('/concert/:concertId', galleryController.getGalleryByConcert);

// ============ PROTECTED ROUTES ============
router.use(protect);
router.use(authorize('organizer', 'admin', 'super_admin'));

// ============ GALLERY CRUD ============
// POST - Upload gallery (concertId dari body, bukan params)
router.post('/', upload.single('image'), galleryController.uploadGallery);

// GET - Get all gallery (with filter)
router.get('/', galleryController.getGallery);

// PUT - Update gallery
router.put('/:id', galleryController.updateGallery);

// DELETE - Delete gallery
router.delete('/:id', galleryController.deleteGallery);

// ============ CONCERT THUMBNAIL & BANNER ============
router.post(
  '/concert/:concertId/thumbnail',
  upload.single('thumbnail'),
  galleryController.uploadThumbnail
);

router.post(
  '/concert/:concertId/banner',
  upload.single('banner'),
  galleryController.uploadBanner
);

module.exports = router;