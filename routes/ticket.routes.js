// routes/ticket.routes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const ticketController = require('../controllers/ticket.controller');

// Semua route memerlukan auth dan role organizer atau admin
router.use(protect);
router.use(authorize('organizer', 'admin', 'super_admin'));

router.get('/', ticketController.getTickets);
router.get('/scans', ticketController.getConcertScans);
router.post('/scan', ticketController.scanTicket);
router.post('/', ticketController.createTicket);
router.put('/:id', ticketController.updateTicket);
router.delete('/:id', ticketController.deleteTicket);

module.exports = router;