const { Concert, Venue, Seat, OrganizerProfile } = require('../models');
const { Op } = require('sequelize');

// @desc    Get seats by concert
// @route   GET /api/seats/concerts/:concertId/seats
exports.getSeatsByConcert = async (req, res) => {
  try {
    const { concertId } = req.params;
    
    const concert = await Concert.findByPk(concertId, {
      include: [{ model: Venue, as: 'venue' }]
    });

    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    if (!['published', 'on_sale', 'upcoming'].includes(concert.status)) {
      return res.status(404).json({ success: false, message: 'Concert not found' });
    }

    const seats = await Seat.findAll({
      where: { concertId },
      order: [['sectionId', 'ASC'], ['row', 'ASC'], ['number', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        concert,
        venue: concert.venue,
        seats: seats || []
      }
    });
  } catch (error) {
    console.error('❌ Get seats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get seats by venue (Public)
// @route   GET /api/seats/venues/:venueId/seats
exports.getSeatsByVenue = async (req, res) => {
  try {
    const { venueId } = req.params;
    
    const venue = await Venue.findByPk(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found'
      });
    }

    const seats = await Seat.findAll({
      where: { venueId },
      order: [['sectionId', 'ASC'], ['row', 'ASC'], ['number', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        venue,
        seats
      }
    });
  } catch (error) {
    console.error('Error getting venue seats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Helper function to check if organizer owns the concert
const checkConcertOwnership = async (concertId, userId) => {
  const concert = await Concert.findOne({
    where: { id: concertId, organizerId: userId }
  });
  
  if (!concert) {
    throw new Error('Concert not found or you do not have permission to manage it');
  }
  
  return concert;
};

// @desc    Generate seats for concert (Organizer only)
// @route   POST /api/seats/concerts/:concertId/generate-seats
exports.generateSeats = async (req, res) => {
  try {
    const { concertId } = req.params;
    const organizerId = req.user.id;
    const { config } = req.body;

    const concert = await Concert.findOne({
      where: { id: concertId, organizerId }
    });

    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found or not owned by you'
      });
    }

    // Delete existing seats
    await Seat.destroy({ where: { concertId } });

    const newSeats = [];
    const sections = config?.sections || [
      { id: 'vvip', name: 'VVIP', category: 'vvip', rows: 3, seatsPerRow: 8, price: 750000 },
      { id: 'vip', name: 'VIP', category: 'vip', rows: 5, seatsPerRow: 10, price: 450000 },
      { id: 'regular', name: 'Regular', category: 'regular', rows: 10, seatsPerRow: 15, price: 200000 }
    ];

    sections.forEach((section, sectionIndex) => {
      const rows = section.rows || 5;
      const seatsPerRow = section.seatsPerRow || 10;
      const category = section.category || 'regular';
      const price = section.price || 150000;

      for (let r = 0; r < rows; r++) {
        const rowLetter = String.fromCharCode(65 + r);
        for (let s = 0; s < seatsPerRow; s++) {
          newSeats.push({
            concertId: parseInt(concertId),
            venueId: concert.venueId || null,
            sectionId: section.id || `section-${sectionIndex}`,
            sectionName: section.name || `Section ${String.fromCharCode(65 + sectionIndex)}`,
            row: rowLetter,
            number: s + 1,
            category: category,
            price: price,
            status: 'available',
            x: 0.1 + (s / seatsPerRow) * 0.8,
            y: 0.15 + (r / rows) * 0.75,
            rotation: 0
          });
        }
      }
    });

    const createdSeats = await Seat.bulkCreate(newSeats);

    // Update concert total tickets
    await concert.update({
      totalTickets: createdSeats.length,
      availableTickets: createdSeats.length
    });

    res.json({
      success: true,
      data: createdSeats,
      message: `${createdSeats.length} seats generated successfully`
    });
  } catch (error) {
    console.error('❌ Generate seats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add single seat (Organizer only)
// @route   POST /api/seats/concerts/:concertId/seats
exports.addSeat = async (req, res) => {
  try {
    const { concertId } = req.params;
    const organizerId = req.user.id;
    const { sectionId, sectionName, row, number, category, price, status } = req.body;

    const concert = await Concert.findOne({
      where: { id: concertId, organizerId }
    });

    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found or not owned by you'
      });
    }

    const seat = await Seat.create({
      concertId,
      venueId: concert.venueId || null,
      sectionId: sectionId || 'default',
      sectionName: sectionName || 'Default',
      row: row || 'A',
      number: number || 1,
      category: category || 'regular',
      price: price || 150000,
      status: status || 'available',
      x: 0.5,
      y: 0.5,
      rotation: 0
    });

    // Update concert total tickets
    await concert.increment('totalTickets');
    await concert.increment('availableTickets');

    res.status(201).json({
      success: true,
      data: seat,
      message: 'Seat added successfully'
    });
  } catch (error) {
    console.error('❌ Add seat error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update seat (Organizer only)
// @route   PUT /api/seats/concerts/:concertId/seats/:seatId
exports.updateSeat = async (req, res) => {
  try {
    const { concertId, seatId } = req.params;
    const organizerId = req.user.id;
    const { sectionId, sectionName, row, number, category, price, status, x, y, rotation } = req.body;

    const concert = await Concert.findOne({
      where: { id: concertId, organizerId }
    });

    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found or not owned by you'
      });
    }

    const seat = await Seat.findOne({
      where: { id: seatId, concertId }
    });

    if (!seat) {
      return res.status(404).json({
        success: false,
        message: 'Seat not found'
      });
    }

    await seat.update({
      sectionId: sectionId || seat.sectionId,
      sectionName: sectionName || seat.sectionName,
      row: row || seat.row,
      number: number || seat.number,
      category: category || seat.category,
      price: price || seat.price,
      status: status || seat.status,
      x: x !== undefined ? x : seat.x,
      y: y !== undefined ? y : seat.y,
      rotation: rotation !== undefined ? rotation : seat.rotation
    });

    res.json({
      success: true,
      data: seat,
      message: 'Seat updated successfully'
    });
  } catch (error) {
    console.error('❌ Update seat error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete seat (Organizer only)
// @route   DELETE /api/seats/concerts/:concertId/seats/:seatId
exports.deleteSeat = async (req, res) => {
  try {
    const { concertId, seatId } = req.params;
    const organizerId = req.user.id;

    const concert = await Concert.findOne({
      where: { id: concertId, organizerId }
    });

    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found or not owned by you'
      });
    }

    const seat = await Seat.findOne({
      where: { id: seatId, concertId }
    });

    if (!seat) {
      return res.status(404).json({
        success: false,
        message: 'Seat not found'
      });
    }

    if (seat.status === 'booked' || seat.status === 'reserved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete booked or reserved seat'
      });
    }

    await seat.destroy();

    // Update concert total tickets
    await concert.decrement('totalTickets');
    await concert.decrement('availableTickets');

    res.json({
      success: true,
      message: 'Seat deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete seat error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add section (Organizer only)
// @route   POST /api/seats/concerts/:concertId/sections
exports.addSection = async (req, res) => {
  try {
    const { concertId } = req.params;
    const userId = req.user.id;
    const { name, category, rows, seatsPerRow, price } = req.body;

    // Check if concert belongs to organizer
    const concert = await checkConcertOwnership(concertId, userId);

    const venue = await Venue.findByPk(concert.venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found'
      });
    }

    // Update venue seat config
    const seatConfig = venue.seatConfig || { sections: [] };
    const newSection = {
      id: `section-${Date.now()}`,
      name: name || `Section ${String.fromCharCode(65 + seatConfig.sections.length)}`,
      category: category || 'regular',
      rows: rows || 10,
      seatsPerRow: seatsPerRow || 10,
      price: price || 100000
    };

    seatConfig.sections.push(newSection);
    await venue.update({ seatConfig });

    res.status(201).json({
      success: true,
      data: newSection,
      message: 'Section added successfully'
    });
  } catch (error) {
    console.error('Error adding section:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete section (Organizer only)
// @route   DELETE /api/seats/concerts/:concertId/sections/:sectionId
exports.deleteSection = async (req, res) => {
  try {
    const { concertId, sectionId } = req.params;
    const userId = req.user.id;

    // Check if concert belongs to organizer
    await checkConcertOwnership(concertId, userId);

    const concert = await Concert.findByPk(concertId);
    const venue = await Venue.findByPk(concert.venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found'
      });
    }

    // Delete all seats in section
    await Seat.destroy({ where: { concertId, sectionId } });

    // Remove section from venue config
    const seatConfig = venue.seatConfig || { sections: [] };
    seatConfig.sections = seatConfig.sections.filter(s => s.id !== sectionId);
    await venue.update({ seatConfig });

    res.json({
      success: true,
      message: 'Section deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting section:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update seat config (Organizer only)
// @route   PUT /api/seats/concerts/:concertId/seat-config
exports.updateSeatConfig = async (req, res) => {
  try {
    const { concertId } = req.params;
    const userId = req.user.id;
    const { config } = req.body;

    // Check if concert belongs to organizer
    await checkConcertOwnership(concertId, userId);

    const concert = await Concert.findByPk(concertId);
    const venue = await Venue.findByPk(concert.venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found'
      });
    }

    await venue.update({ seatConfig: config });

    res.json({
      success: true,
      message: 'Seat configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating seat config:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};