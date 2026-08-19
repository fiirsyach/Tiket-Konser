const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const seatController = require('../controllers/seat.controller');

// Public routes - customer bisa melihat seat map
router.get('/concerts/:concertId/seats', seatController.getSeatsByConcert);
router.get('/venues/:venueId/seats', seatController.getSeatsByVenue);

// Organizer routes - hanya organizer yang bisa mengelola seat map
router.post('/concerts/:concertId/generate-seats', protect, authorize('organizer', 'super_admin'), seatController.generateSeats);
router.post('/concerts/:concertId/seats', protect, authorize('organizer', 'super_admin'), seatController.addSeat);
router.put('/concerts/:concertId/seats/:seatId', protect, authorize('organizer', 'super_admin'), seatController.updateSeat);
router.delete('/concerts/:concertId/seats/:seatId', protect, authorize('organizer', 'super_admin'), seatController.deleteSeat);
router.post('/concerts/:concertId/sections', protect, authorize('organizer', 'super_admin'), seatController.addSection);
router.delete('/concerts/:concertId/sections/:sectionId', protect, authorize('organizer', 'super_admin'), seatController.deleteSection);
router.put('/concerts/:concertId/seat-config', protect, authorize('organizer', 'super_admin'), seatController.updateSeatConfig);

module.exports = router;