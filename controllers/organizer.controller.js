const { 
  User, 
  OrganizerProfile, 
  Concert, 
  Order, 
  Ticket, 
  Payment, 
  Withdrawal, 
  Gallery, 
  Promotion, 
  Venue, 
  Category,
  Seat,
  SeatLayout,
  Review,
  Artist,
  sequelize
} = require('../models');
const { Op, Sequelize } = require('sequelize');
const slugify = require('slugify');

// ==================== DASHBOARD ====================
exports.getDashboard = async (req, res) => {
  try {
    const organizerId = req.user.id;
    console.log('📊 Fetching organizer dashboard for:', organizerId);

    const totalConcerts = await Concert.count({ where: { organizerId } });
    const totalOrders = await Order.count({ where: { organizerId } });

    const [revenueResult] = await sequelize.query(
      `SELECT SUM(p.amount) as total 
       FROM Payments p 
       INNER JOIN Orders o ON p.orderId = o.id 
       WHERE o.organizerId = ? AND p.status = 'completed'`,
      {
        replacements: [organizerId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    const revenue = parseFloat(revenueResult?.total) || 0;

    const soldTickets = await Ticket.count({
      include: [{
        model: Order,
        as: 'order',
        where: { organizerId },
        required: true
      }]
    });

    const pendingOrders = await Order.count({ 
      where: { organizerId, status: 'pending' }
    });

    const concerts = await Concert.findAll({
      where: { organizerId },
      attributes: [
        [Sequelize.fn('SUM', Sequelize.col('availableTickets')), 'available']
      ],
      raw: true
    });
    const availableTickets = parseInt(concerts[0]?.available) || 0;

    const recentOrders = await Order.findAll({
      where: { organizerId },
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'user', attributes: ['id', 'name'] },
        { model: Concert, as: 'concert', attributes: ['id', 'name', 'thumbnail'] },
        { model: Payment, as: 'orderPayment', attributes: ['id', 'amount', 'status'] }
      ]
    });

    const monthlyRevenue = await Order.findAll({
      where: {
        organizerId,
        status: 'paid',
        createdAt: {
          [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 12))
        }
      },
      attributes: [
        [Sequelize.fn('DATE_FORMAT', Sequelize.col('createdAt'), '%Y-%m'), 'month'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
        [Sequelize.fn('SUM', Sequelize.col('totalAmount')), 'total']
      ],
      group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('createdAt'), '%Y-%m')],
      order: [[Sequelize.fn('DATE_FORMAT', Sequelize.col('createdAt'), '%Y-%m'), 'ASC']],
      raw: true
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalConcerts: totalConcerts || 0,
          totalOrders: totalOrders || 0,
          revenue: revenue || 0,
          soldTickets: soldTickets || 0,
          pendingOrders: pendingOrders || 0,
          availableTickets: availableTickets || 0
        },
        recentOrders,
        monthlyRevenue
      }
    });
  } catch (error) {
    console.error('❌ Organizer dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch dashboard data'
    });
  }
};

// ==================== PROFILE ====================
exports.getProfile = async (req, res) => {
  try {
    const profile = await OrganizerProfile.findOne({
      where: { userId: req.user.id },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'avatar'] }
      ]
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Organizer profile not found'
      });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const profile = await OrganizerProfile.findOne({
      where: { userId: req.user.id }
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Organizer profile not found'
      });
    }

    await profile.update(req.body);

    res.json({
      success: true,
      data: profile,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== CONCERT MANAGEMENT ====================
exports.getConcerts = async (req, res) => {
  try {
    const concerts = await Concert.findAll({
      where: { organizerId: req.user.id },
      include: [
        { model: Venue, as: 'venue' }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: concerts
    });
  } catch (error) {
    console.error('❌ Get concerts error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get concerts'
    });
  }
};

exports.createConcert = async (req, res) => {
  try {
    const organizerId = req.user.id;
    
    console.log('📝 Create concert request body:', req.body);
    
    const profile = await OrganizerProfile.findOne({ 
      where: { userId: organizerId }
    });

    if (!profile) {
      return res.status(403).json({
        success: false,
        message: 'Organizer profile not found'
      });
    }

    if (profile.verificationStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        message: `Your organizer account is ${profile.verificationStatus}`
      });
    }

    const { 
      name, 
      description, 
      date, 
      time,
      venueType,
      venueName,
      city,
      address,
      capacity,
      totalTickets,
      minPrice,
      maxPrice,
      genre,
      rules,
      youtubeTrailer,
      isFeatured,
      isFlashSale,
      flashSalePrice,
      flashSaleEnd,
      sections,
      status
    } = req.body;

    // Validasi
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Concert name is required'
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required'
      });
    }

    if (!time) {
      return res.status(400).json({
        success: false,
        message: 'Time is required'
      });
    }

    if (!venueType) {
      return res.status(400).json({
        success: false,
        message: 'Venue type is required. Please select a venue type first.'
      });
    }

    if (!venueName) {
      return res.status(400).json({
        success: false,
        message: 'Venue name is required'
      });
    }

    if (!city) {
      return res.status(400).json({
        success: false,
        message: 'City is required'
      });
    }

    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Address is required'
      });
    }

    // Generate seat map configuration
    const seatMapConfig = {
      sections: sections || [],
      stagePosition: 'front',
      totalSeats: parseInt(totalTickets) || 0
    };

    const slug = slugify(name, { lower: true, strict: true });

    const concertData = {
      organizerId,
      name: name.trim(),
      slug,
      description: description || null,
      date,
      time,
      venueType,
      venueName: venueName.trim(),
      city: city.trim(),
      address: address.trim(),
      venueId: null,
      categoryId: null,
      artistId: null,
      minPrice: parseFloat(minPrice) || 0,
      maxPrice: parseFloat(maxPrice) || 0,
      totalTickets: parseInt(totalTickets) || 0,
      availableTickets: parseInt(totalTickets) || 0,
      genre: genre || null,
      rules: rules || null,
      youtubeTrailer: youtubeTrailer || null,
      isFeatured: isFeatured || false,
      isFlashSale: isFlashSale || false,
      flashSalePrice: flashSalePrice || null,
      flashSaleEnd: flashSaleEnd || null,
      seatMapConfig: seatMapConfig,
      status: status || 'draft'
    };

    const concert = await Concert.create(concertData);

    res.status(201).json({
      success: true,
      data: concert,
      message: 'Concert created successfully with venue layout'
    });
  } catch (error) {
    console.error('❌ Create concert error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create concert'
    });
  }
};

// ==================== HELPER: Generate Seats for Concert ====================
async function generateSeatsForConcert(concertId, venue) {
  try {
    const config = venue.seatConfig || { sections: [] };
    const sections = config.sections || [];
    const seats = [];

    sections.forEach((section, sectionIndex) => {
      const rows = section.rows || 10;
      const seatsPerRow = section.seatsPerRow || 10;
      const category = section.category || 'regular';
      const price = section.price || 100000;

      for (let r = 0; r < rows; r++) {
        const rowLetter = String.fromCharCode(65 + r);
        for (let s = 0; s < seatsPerRow; s++) {
          seats.push({
            concertId,
            venueId: venue.id,
            sectionId: section.id || `section-${sectionIndex}`,
            sectionName: section.name || `Section ${String.fromCharCode(65 + sectionIndex)}`,
            row: rowLetter,
            number: s + 1,
            category: category,
            price: price,
            status: 'available',
            // Calculate position based on venue type
            x: calculateSeatX(section, r, s, rows, seatsPerRow, venue.type),
            y: calculateSeatY(section, r, s, rows, seatsPerRow, venue.type),
            rotation: calculateSeatRotation(section, r, s, rows, seatsPerRow, venue.type)
          });
        }
      }
    });

    // Bulk create seats
    if (seats.length > 0) {
      await Seat.bulkCreate(seats);
      console.log(`✅ Generated ${seats.length} seats for concert ${concertId}`);
    }

    return seats;
  } catch (error) {
    console.error('❌ Error generating seats:', error);
    throw error;
  }
}

function calculateSeatX(section, row, seat, totalRows, totalSeats, venueType) {
  const isStadium = venueType === 'stadium' || venueType === 'arena';
  if (isStadium) {
    const angle = section.angle || (row / totalRows) * 2 * Math.PI;
    const radius = 0.35 + (row / totalRows) * 0.1;
    const seatAngle = (seat / totalSeats) * 0.3;
    return 0.5 + radius * Math.cos(angle + seatAngle);
  }
  // Concert Hall, Outdoor, Theater, Club
  return 0.1 + (seat / totalSeats) * 0.8;
}

function calculateSeatY(section, row, seat, totalRows, totalSeats, venueType) {
  const isStadium = venueType === 'stadium' || venueType === 'arena';
  if (isStadium) {
    const angle = section.angle || (row / totalRows) * 2 * Math.PI;
    const radius = 0.35 + (row / totalRows) * 0.1;
    const seatAngle = (seat / totalSeats) * 0.3;
    return 0.5 + radius * Math.sin(angle + seatAngle);
  }
  return 0.15 + (row / totalRows) * 0.75;
}

function calculateSeatRotation(section, row, seat, totalRows, totalSeats, venueType) {
  const isStadium = venueType === 'stadium' || venueType === 'arena';
  if (isStadium) {
    const angle = section.angle || (row / totalRows) * 2 * Math.PI;
    return angle + Math.PI / 2;
  }
  return 0;
}

exports.updateConcert = async (req, res) => {
  try {
    const concertId = req.params.id;
    const organizerId = req.user.id;

    const concert = await Concert.findOne({
      where: { id: concertId, organizerId }
    });

    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    if (concert.status === 'published' || concert.status === 'on_sale') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update published or on-sale concert'
      });
    }

    const {
      name,
      description,
      date,
      time,
      venueName,
      city,
      address,
      venueId,
      categoryId,
      minPrice,
      maxPrice,
      totalTickets,
      genre
    } = req.body;

    let updateData = {
      name: name || concert.name,
      description: description || concert.description,
      date: date || concert.date,
      time: time || concert.time,
      venueName: venueName || concert.venueName || '',
      city: city || concert.city || '',
      address: address || concert.address || '',
      venueId: venueId || concert.venueId || null,
      categoryId: categoryId || concert.categoryId || null,
      minPrice: parseFloat(minPrice) || concert.minPrice || 0,
      maxPrice: parseFloat(maxPrice) || concert.maxPrice || 0,
      totalTickets: parseInt(totalTickets) || concert.totalTickets || 0,
      availableTickets: parseInt(totalTickets) || concert.availableTickets || 0,
      genre: genre || concert.genre || '',
      artistId: null
    };

    if (name && name !== concert.name) {
      const slug = slugify(name, { lower: true, strict: true });
      updateData.slug = slug;
    }

    await concert.update(updateData);

    const updatedConcert = await Concert.findByPk(concert.id, {
      include: [
        { model: Venue, as: 'venue' }
      ]
    });

    res.json({
      success: true,
      data: updatedConcert,
      message: 'Concert updated successfully'
    });
  } catch (error) {
    console.error('❌ Update concert error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update concert'
    });
  }
};

exports.deleteConcert = async (req, res) => {
  try {
    const concert = req.concert;

    if (concert.status === 'published' || concert.status === 'on_sale') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete published or on-sale concert'
      });
    }

    await concert.destroy();

    res.json({
      success: true,
      message: 'Concert deleted successfully'
    });
  } catch (error) {
    console.error('Delete concert error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.publishConcert = async (req, res) => {
  try {
    const concertId = req.params.id;
    const organizerId = req.user.id;

    const concert = await Concert.findOne({
      where: { id: concertId, organizerId }
    });

    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    if (concert.status === 'published') {
      return res.status(400).json({
        success: false,
        message: 'Concert is already published!'
      });
    }

    if (concert.status === 'on_sale') {
      return res.status(400).json({
        success: false,
        message: 'Concert is already on sale!'
      });
    }

    if (concert.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Concert was rejected. Please edit and resubmit.'
      });
    }

    if (concert.status === 'finished' || concert.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `Concert is already ${concert.status}`
      });
    }

    await concert.update({ 
      status: 'published'
    });

    const updatedConcert = await Concert.findByPk(concert.id, {
      include: [
        { model: Venue, as: 'venue' }
      ]
    });

    res.json({
      success: true,
      data: updatedConcert,
      message: 'Concert published successfully'
    });
  } catch (error) {
    console.error('❌ Publish concert error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to publish concert'
    });
  }
};

exports.unpublishConcert = async (req, res) => {
  try {
    const concertId = req.params.id;
    const organizerId = req.user.id;

    const concert = await Concert.findOne({
      where: { id: concertId, organizerId }
    });

    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    if (concert.status !== 'published' && concert.status !== 'on_sale') {
      return res.status(400).json({
        success: false,
        message: 'Concert is not published or on sale'
      });
    }

    await concert.update({ 
      status: 'draft'
    });

    res.json({
      success: true,
      data: concert,
      message: 'Concert unpublished successfully'
    });
  } catch (error) {
    console.error('❌ Unpublish concert error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to unpublish concert'
    });
  }
};

// ==================== TICKET MANAGEMENT ====================
exports.getTickets = async (req, res) => {
  try {
    const organizerId = req.user.id;
    console.log('📊 Fetching tickets for organizer:', organizerId);
    
    // Ambil semua tiket milik organizer
    const tickets = await Ticket.findAll({
      where: { organizerId },
      include: [
        { 
          model: Concert, 
          as: 'concert', 
          attributes: ['id', 'name', 'date', 'thumbnail'] 
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    console.log('✅ Found tickets:', tickets.length);

    res.json({
      success: true,
      data: tickets
    });
  } catch (error) {
    console.error('❌ Get tickets error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get tickets'
    });
  }
};

exports.createTicket = async (req, res) => {
  try {
    const organizerId = req.user.id;
    const { category, price, quota, concertId } = req.body;

    const ticket = await Ticket.create({
      organizerId,
      category,
      price,
      quota,
      available: quota,
      sold: 0,
      concertId
    });

    res.status(201).json({
      success: true,
      data: ticket,
      message: 'Ticket created successfully'
    });
  } catch (error) {
    console.error('❌ Create ticket error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create ticket'
    });
  }
};

exports.updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const organizerId = req.user.id;
    const { category, price, quota } = req.body;

    const ticket = await Ticket.findOne({
      where: { id, organizerId }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    await ticket.update({ category, price, quota });

    res.json({
      success: true,
      data: ticket,
      message: 'Ticket updated successfully'
    });
  } catch (error) {
    console.error('❌ Update ticket error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update ticket'
    });
  }
};

exports.deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const organizerId = req.user.id;

    const ticket = await Ticket.findOne({
      where: { id, organizerId }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    await ticket.destroy();

    res.json({
      success: true,
      message: 'Ticket deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete ticket error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete ticket'
    });
  }
};

// ==================== SEAT LAYOUT ====================
exports.getSeats = async (req, res) => {
  try {
    const organizerId = req.user.id;
    const { concertId } = req.query;
    
    console.log('📊 Fetching seats for organizer:', organizerId);
    console.log('📝 Concert filter:', concertId);

    // Ambil semua concert milik organizer
    const whereConcert = { organizerId };
    if (concertId) whereConcert.id = concertId;

    const concerts = await Concert.findAll({
      where: whereConcert,
      attributes: ['id']
    });

    const concertIds = concerts.map(c => c.id);

    if (concertIds.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Ambil seats berdasarkan concertIds
    const seats = await Seat.findAll({
      where: { 
        concertId: { [Op.in]: concertIds }
      },
      include: [
        { 
          model: Concert, 
          as: 'concert', 
          attributes: ['id', 'name', 'venueName', 'date'] 
        }
      ],
      order: [['concertId', 'ASC'], ['row', 'ASC'], ['number', 'ASC']]
    });

    console.log('✅ Found seats:', seats.length);

    res.json({
      success: true,
      data: seats
    });
  } catch (error) {
    console.error('❌ Get seats error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get seats'
    });
  }
};

exports.createSeat = async (req, res) => {
  try {
    const organizerId = req.user.id;
    const { row, number, category, price, concertId, sectionId, sectionName, status } = req.body;

    console.log('📝 Create seat request:', req.body);
    console.log('👤 Organizer ID:', organizerId);

    // Validasi
    if (!row) {
      return res.status(400).json({
        success: false,
        message: 'Row is required'
      });
    }
    if (!number) {
      return res.status(400).json({
        success: false,
        message: 'Seat number is required'
      });
    }
    if (!concertId) {
      return res.status(400).json({
        success: false,
        message: 'Concert ID is required'
      });
    }

    // Verifikasi concert milik organizer
    const concert = await Concert.findOne({
      where: { 
        id: parseInt(concertId), 
        organizerId: organizerId 
      }
    });

    if (!concert) {
      console.log('❌ Concert not found:', { concertId, organizerId });
      return res.status(404).json({
        success: false,
        message: 'Concert not found or not owned by you'
      });
    }

    console.log('✅ Concert found:', concert.id, concert.name);

    // Cek apakah seat sudah ada
    const existingSeat = await Seat.findOne({
      where: { 
        concertId: parseInt(concertId), 
        row: row.toUpperCase(), 
        number: parseInt(number) 
      }
    });

    if (existingSeat) {
      return res.status(400).json({
        success: false,
        message: `Seat ${row.toUpperCase()}${number} already exists`
      });
    }

    // Buat seat
    const seat = await Seat.create({
      concertId: parseInt(concertId),
      venueId: concert.venueId || null,
      sectionId: sectionId || 'default',
      sectionName: sectionName || 'Default Section',
      row: row.toUpperCase(),
      number: parseInt(number),
      category: category || 'regular',
      price: parseFloat(price) || 0,
      status: status || 'available',
      x: 0.5,
      y: 0.5,
      rotation: 0
    });

    // Update concert total tickets
    await concert.increment('totalTickets');
    await concert.increment('availableTickets');

    console.log('✅ Seat created:', seat.id);

    res.status(201).json({
      success: true,
      data: seat,
      message: 'Seat created successfully'
    });
  } catch (error) {
    console.error('❌ Create seat error:', error);
    
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create seat'
    });
  }
};

exports.updateSeat = async (req, res) => {
  try {
    const { id } = req.params;
    const organizerId = req.user.id;
    const { row, number, category, price, status, sectionId, sectionName } = req.body;

    console.log('📝 Update seat request:', { id, ...req.body });
    console.log('👤 Organizer ID:', organizerId);

    // Cari seat dengan join ke concert
    const seat = await Seat.findOne({
      where: { id: parseInt(id) },
      include: [{
        model: Concert,
        as: 'concert',
        where: { organizerId: organizerId },
        required: true
      }]
    });

    if (!seat) {
      console.log('❌ Seat not found:', { id, organizerId });
      return res.status(404).json({
        success: false,
        message: 'Seat not found or not owned by you'
      });
    }

    console.log('✅ Seat found:', seat.id);

    // Update seat
    await seat.update({
      row: row || seat.row,
      number: number || seat.number,
      category: category || seat.category,
      price: price || seat.price,
      status: status || seat.status,
      sectionId: sectionId || seat.sectionId,
      sectionName: sectionName || seat.sectionName
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
      message: error.message || 'Failed to update seat'
    });
  }
};

exports.deleteSeat = async (req, res) => {
  try {
    const { id } = req.params;
    const organizerId = req.user.id;

    console.log('📝 Delete seat request:', id);
    console.log('👤 Organizer ID:', organizerId);

    // Cari seat dengan join ke concert
    const seat = await Seat.findOne({
      where: { id: parseInt(id) },
      include: [{
        model: Concert,
        as: 'concert',
        where: { organizerId: organizerId },
        required: true
      }]
    });

    if (!seat) {
      console.log('❌ Seat not found:', { id, organizerId });
      return res.status(404).json({
        success: false,
        message: 'Seat not found or not owned by you'
      });
    }

    console.log('✅ Seat found:', seat.id);

    if (seat.status === 'booked' || seat.status === 'reserved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete booked or reserved seat'
      });
    }

    await seat.destroy();

    // Update concert total tickets
    const concert = await Concert.findByPk(seat.concertId);
    if (concert) {
      await concert.decrement('totalTickets');
      await concert.decrement('availableTickets');
    }

    res.json({
      success: true,
      message: 'Seat deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete seat error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete seat'
    });
  }
};


// ==================== GALLERY ====================
exports.getGallery = async (req, res) => {
  try {
    const organizerId = req.user.id;
    console.log('📊 Fetching gallery for organizer:', organizerId);

    // Ambil semua concert milik organizer
    const concerts = await Concert.findAll({
      where: { organizerId },
      attributes: ['id']
    });

    const concertIds = concerts.map(c => c.id);

    if (concertIds.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Ambil gallery berdasarkan concertIds
    const gallery = await Gallery.findAll({
      where: { 
        concertId: { [Op.in]: concertIds }
      },
      include: [
        { 
          model: Concert, 
          as: 'concert', 
          attributes: ['id', 'name'] 
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    console.log('✅ Found gallery items:', gallery.length);

    res.json({
      success: true,
      data: gallery
    });
  } catch (error) {
    console.error('❌ Get gallery error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get gallery'
    });
  }
};

exports.uploadGallery = async (req, res) => {
  try {
    const organizerId = req.user.id;
    const { image, caption, type, concertId } = req.body;

    // Verifikasi concert milik organizer
    const concert = await Concert.findOne({
      where: { id: concertId, organizerId }
    });

    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found or not owned by you'
      });
    }

    const gallery = await Gallery.create({
      image,
      caption: caption || null,
      type: type || 'photo',
      concertId
    });

    res.status(201).json({
      success: true,
      data: gallery,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('❌ Upload gallery error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload image'
    });
  }
};

exports.deleteGallery = async (req, res) => {
  try {
    const { id } = req.params;
    const organizerId = req.user.id;

    const gallery = await Gallery.findOne({
      where: { id },
      include: [{
        model: Concert,
        as: 'concert',
        where: { organizerId }
      }]
    });

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: 'Gallery item not found'
      });
    }

    await gallery.destroy();

    res.json({
      success: true,
      message: 'Gallery item deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete gallery error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete gallery item'
    });
  }
};

// ==================== PROMO ====================
exports.getPromos = async (req, res) => {
  try {
    const organizerId = req.user.id;
    const promos = await Promotion.findAll({
      where: { organizerId },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: promos
    });
  } catch (error) {
    console.error('❌ Get promos error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch promos'
    });
  }
};

exports.createPromo = async (req, res) => {
  try {
    const organizerId = req.user.id;
    const { code, name, description, type, value, discountType, minPurchase, maxDiscount, startDate, endDate, maxUses, perUserLimit } = req.body;

    const promo = await Promotion.create({
      organizerId,
      code: code.toUpperCase(),
      name,
      description,
      type,
      value,
      discountType: discountType || 'percentage',
      minPurchase: minPurchase || null,
      maxDiscount: maxDiscount || null,
      startDate,
      endDate,
      maxUses: maxUses || null,
      perUserLimit: perUserLimit || 1,
      status: 'active'
    });

    res.status(201).json({
      success: true,
      data: promo,
      message: 'Promo created successfully'
    });
  } catch (error) {
    console.error('❌ Create promo error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create promo'
    });
  }
};

exports.updatePromo = async (req, res) => {
  try {
    const { id } = req.params;
    const organizerId = req.user.id;

    const promo = await Promotion.findOne({
      where: { id, organizerId }
    });

    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Promo not found'
      });
    }

    await promo.update(req.body);

    res.json({
      success: true,
      data: promo,
      message: 'Promo updated successfully'
    });
  } catch (error) {
    console.error('❌ Update promo error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update promo'
    });
  }
};

exports.deletePromo = async (req, res) => {
  try {
    const { id } = req.params;
    const organizerId = req.user.id;

    const promo = await Promotion.findOne({
      where: { id, organizerId }
    });

    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Promo not found'
      });
    }

    await promo.destroy();

    res.json({
      success: true,
      message: 'Promo deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete promo error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete promo'
    });
  }
};

// ==================== VENUE MANAGEMENT ====================
exports.getOrganizerVenues = async (req, res) => {
  try {
    const organizerId = req.user.id;
    const venues = await Venue.findAll({
      where: { organizerId },
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      data: venues
    });
  } catch (error) {
    console.error('❌ Get organizer venues error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get venues'
    });
  }
};

exports.createOrganizerVenue = async (req, res) => {
  try {
    const organizerId = req.user.id;
    const { name, city, address, capacity, description, facilities, type } = req.body;

    if (!name || !city || !address) {
      return res.status(400).json({
        success: false,
        message: 'Name, city, and address are required'
      });
    }

    const slug = slugify(name, { lower: true, strict: true });

    const venue = await Venue.create({
      name,
      slug,
      city,
      address,
      capacity: capacity || 0,
      description,
      facilities,
      type: type || 'concert_hall',
      organizerId,
      status: 'active'
    });

    res.status(201).json({
      success: true,
      data: venue,
      message: 'Venue created successfully'
    });
  } catch (error) {
    console.error('❌ Create venue error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create venue'
    });
  }
};

exports.updateOrganizerVenue = async (req, res) => {
  try {
    const { id } = req.params;
    const organizerId = req.user.id;

    const venue = await Venue.findOne({
      where: { id, organizerId }
    });

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found or not owned by you'
      });
    }

    const updateData = req.body;
    if (updateData.name) {
      updateData.slug = slugify(updateData.name, { lower: true, strict: true });
    }

    await venue.update(updateData);

    res.json({
      success: true,
      data: venue,
      message: 'Venue updated successfully'
    });
  } catch (error) {
    console.error('❌ Update venue error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update venue'
    });
  }
};

exports.deleteOrganizerVenue = async (req, res) => {
  try {
    const { id } = req.params;
    const organizerId = req.user.id;

    const venue = await Venue.findOne({
      where: { id, organizerId }
    });

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found or not owned by you'
      });
    }

    // Cek apakah venue sedang digunakan di concert
    const concertCount = await Concert.count({
      where: { venueId: id }
    });

    if (concertCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete venue because it is used in ${concertCount} concert(s)`
      });
    }

    await venue.destroy();

    res.json({
      success: true,
      message: 'Venue deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete venue error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete venue'
    });
  }
};

// ==================== ORDERS ====================
exports.getOrders = async (req, res) => {
  try {
    const organizerId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const where = { organizerId };

    if (status) where.status = status;

    const orders = await Order.findAndCountAll({
      where,
      include: [
        { 
          model: User, 
          as: 'user', 
          attributes: ['id', 'name', 'email'] 
        },
        { 
          model: Concert, 
          as: 'concert', 
          attributes: ['id', 'name', 'date', 'thumbnail'] 
        },
        { 
          model: Payment, 
          as: 'orderPayment', 
          attributes: ['id', 'amount', 'method', 'status'] 
        },
        { 
          model: Ticket, 
          as: 'orderTickets', 
          attributes: ['id', 'ticketNumber', 'price', 'status', 'category'] 
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: orders.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: orders.count,
        totalPages: Math.ceil(orders.count / limit)
      }
    });
  } catch (error) {
    console.error('❌ Get orders error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch orders'
    });
  }
};

exports.getOrderDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const organizerId = req.user.id;

    const order = await Order.findOne({
      where: { id, organizerId },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone'] },
        { model: Concert, as: 'concert' },
        { model: Payment, as: 'orderPayment' },
        { model: Ticket, as: 'orderTickets' }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('❌ Get order detail error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get order detail'
    });
  }
};

// ==================== REVENUE ====================
exports.getRevenue = async (req, res) => {
  try {
    const organizerId = req.user.id;
    const { period = 'month' } = req.query;

    console.log('📊 Fetching revenue for organizer:', organizerId);

    // Total Revenue - menggunakan raw query untuk menghindari group by issue
    const [totalRevenueResult] = await sequelize.query(
      `SELECT COALESCE(SUM(p.amount), 0) as total 
       FROM Payments p 
       INNER JOIN Orders o ON p.orderId = o.id 
       WHERE o.organizerId = ? AND p.status = 'completed'`,
      {
        replacements: [organizerId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    const totalRevenue = parseFloat(totalRevenueResult?.total) || 0;

    // Monthly Revenue
    const monthlyRevenue = await sequelize.query(
      `SELECT 
        DATE_FORMAT(o.createdAt, '%Y-%m') as month,
        COALESCE(SUM(o.totalAmount), 0) as total
       FROM Orders o
       WHERE o.organizerId = ? AND o.status = 'paid'
       GROUP BY DATE_FORMAT(o.createdAt, '%Y-%m')
       ORDER BY month ASC
       LIMIT 12`,
      {
        replacements: [organizerId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    // This Month Revenue
    const [thisMonthResult] = await sequelize.query(
      `SELECT COALESCE(SUM(o.totalAmount), 0) as total
       FROM Orders o
       WHERE o.organizerId = ? AND o.status = 'paid' 
       AND MONTH(o.createdAt) = MONTH(CURRENT_DATE()) 
       AND YEAR(o.createdAt) = YEAR(CURRENT_DATE())`,
      {
        replacements: [organizerId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    const thisMonthRevenue = parseFloat(thisMonthResult?.total) || 0;

    // Growth (compare with last month)
    const [lastMonthResult] = await sequelize.query(
      `SELECT COALESCE(SUM(o.totalAmount), 0) as total
       FROM Orders o
       WHERE o.organizerId = ? AND o.status = 'paid' 
       AND MONTH(o.createdAt) = MONTH(CURRENT_DATE() - INTERVAL 1 MONTH) 
       AND YEAR(o.createdAt) = YEAR(CURRENT_DATE() - INTERVAL 1 MONTH)`,
      {
        replacements: [organizerId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    const lastMonthRevenue = parseFloat(lastMonthResult?.total) || 0;
    const growth = lastMonthRevenue > 0 
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : 0;

    // Revenue by Concert
    const byConcert = await sequelize.query(
      `SELECT 
        c.id,
        c.name,
        COALESCE(SUM(o.totalAmount), 0) as revenue,
        COUNT(o.id) as tickets
       FROM Concerts c
       LEFT JOIN Orders o ON o.concertId = c.id AND o.status = 'paid'
       WHERE c.organizerId = ?
       GROUP BY c.id, c.name
       ORDER BY revenue DESC`,
      {
        replacements: [organizerId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    res.json({
      success: true,
      data: {
        total: totalRevenue,
        thisMonth: thisMonthRevenue,
        growth: parseFloat(growth.toFixed(1)),
        monthly: monthlyRevenue.map(item => ({
          month: item.month,
          total: parseFloat(item.total) || 0
        })),
        byConcert: byConcert.map(item => ({
          name: item.name,
          revenue: parseFloat(item.revenue) || 0,
          tickets: parseInt(item.tickets) || 0
        }))
      }
    });
  } catch (error) {
    console.error('❌ Get revenue error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get revenue'
    });
  }
};

// ==================== ANALYTICS ====================
exports.getAnalytics = async (req, res) => {
  try {
    const organizerId = req.user.id;
    const { period = 'month' } = req.query;

    console.log('📊 Fetching analytics for organizer:', organizerId);

    // Total Tickets Sold
    const [totalTicketsResult] = await sequelize.query(
      `SELECT COUNT(*) as total 
       FROM Tickets t
       INNER JOIN Concerts c ON t.concertId = c.id
       WHERE c.organizerId = ?`,
      {
        replacements: [organizerId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    const totalTicketsSold = parseInt(totalTicketsResult?.total) || 0;

    // Total Revenue
    const [totalRevenueResult] = await sequelize.query(
      `SELECT COALESCE(SUM(o.totalAmount), 0) as total 
       FROM Orders o
       WHERE o.organizerId = ? AND o.status = 'paid'`,
      {
        replacements: [organizerId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    const totalRevenue = parseFloat(totalRevenueResult?.total) || 0;

    // Total Concerts
    const totalConcerts = await Concert.count({
      where: { organizerId }
    });

    // Average Rating
    const [avgRatingResult] = await sequelize.query(
      `SELECT COALESCE(AVG(r.rating), 0) as avg 
       FROM Reviews r
       INNER JOIN Concerts c ON r.concertId = c.id
       WHERE c.organizerId = ?`,
      {
        replacements: [organizerId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    const averageRating = parseFloat(avgRatingResult?.avg) || 0;

    // Tickets by Category
    const ticketsByCategory = await sequelize.query(
      `SELECT 
        t.category,
        COUNT(t.id) as sold,
        COALESCE(SUM(t.price), 0) as revenue
       FROM Tickets t
       INNER JOIN Concerts c ON t.concertId = c.id
       WHERE c.organizerId = ?
       GROUP BY t.category`,
      {
        replacements: [organizerId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    // Top Concerts
    const topConcerts = await sequelize.query(
      `SELECT 
        c.id,
        c.name,
        COUNT(t.id) as tickets,
        COALESCE(SUM(o.totalAmount), 0) as revenue,
        COALESCE(AVG(r.rating), 0) as rating
       FROM Concerts c
       LEFT JOIN Tickets t ON t.concertId = c.id
       LEFT JOIN Orders o ON o.concertId = c.id AND o.status = 'paid'
       LEFT JOIN Reviews r ON r.concertId = c.id
       WHERE c.organizerId = ?
       GROUP BY c.id, c.name
       ORDER BY tickets DESC
       LIMIT 5`,
      {
        replacements: [organizerId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    // Daily Sales (last 30 days)
    const dailySales = await sequelize.query(
      `SELECT 
        DATE(o.createdAt) as date,
        COUNT(o.id) as sales
       FROM Orders o
       WHERE o.organizerId = ? AND o.status = 'paid'
       AND o.createdAt >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
       GROUP BY DATE(o.createdAt)
       ORDER BY date ASC`,
      {
        replacements: [organizerId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    // Views (dari concert views)
    const [viewsResult] = await sequelize.query(
      `SELECT COALESCE(SUM(c.views), 0) as total 
       FROM Concerts c
       WHERE c.organizerId = ?`,
      {
        replacements: [organizerId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    const views = parseInt(viewsResult?.total) || 0;

    // Conversion Rate (views to tickets)
    const conversionRate = views > 0 ? ((totalTicketsSold / views) * 100) : 0;

    // Upcoming Concerts
    const upcomingConcerts = await Concert.count({
      where: { 
        organizerId,
        date: { [Op.gte]: new Date() },
        status: { [Op.in]: ['published', 'on_sale'] }
      }
    });

    res.json({
      success: true,
      data: {
        totalTicketsSold,
        totalRevenue,
        totalConcerts,
        averageRating: parseFloat(averageRating.toFixed(1)),
        views,
        conversionRate: parseFloat(conversionRate.toFixed(1)),
        upcomingConcerts,
        ticketsByCategory: ticketsByCategory.map(item => ({
          category: item.category,
          sold: parseInt(item.sold) || 0,
          revenue: parseFloat(item.revenue) || 0
        })),
        topConcerts: topConcerts.map(item => ({
          name: item.name,
          tickets: parseInt(item.tickets) || 0,
          revenue: parseFloat(item.revenue) || 0,
          rating: parseFloat(item.rating) || 0
        })),
        dailySales: dailySales.map(item => ({
          date: item.date,
          sales: parseInt(item.sales) || 0
        }))
      }
    });
  } catch (error) {
    console.error('❌ Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get analytics'
    });
  }
};

// ==================== WITHDRAWAL ====================
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, bankName, bankAccount, bankHolder } = req.body;

    const profile = await OrganizerProfile.findOne({
      where: { userId: req.user.id }
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Organizer profile not found'
      });
    }

    const totalRevenue = await Payment.sum('amount', {
      where: { status: 'completed' },
      include: [{
        model: Order,
        as: 'order',
        where: { organizerId: req.user.id }
      }]
    });

    const totalWithdrawn = await Withdrawal.sum('amount', {
      where: { 
        organizerId: req.user.id,
        status: { [Op.in]: ['pending', 'processing', 'completed'] }
      }
    });

    const available = (totalRevenue || 0) - (totalWithdrawn || 0);

    if (amount > available) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: Rp ${available.toLocaleString()}`
      });
    }

    const withdrawal = await Withdrawal.create({
      organizerId: req.user.id,
      amount,
      bankName: bankName || profile.bankName,
      bankAccount: bankAccount || profile.bankAccount,
      bankHolder: bankHolder || profile.bankHolder,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      data: withdrawal,
      message: 'Withdrawal request submitted successfully'
    });
  } catch (error) {
    console.error('❌ Request withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to request withdrawal'
    });
  }
};

// ==================== SEAT EDITOR ====================
// @desc    Get seat editor page data
// @route   GET /api/organizer/concerts/:id/seat-editor
exports.getSeatEditor = async (req, res) => {
  try {
    const concertId = req.params.id;
    const organizerId = req.user.id;

    // Cek apakah concert milik organizer
    const concert = await Concert.findOne({
      where: { id: concertId, organizerId },
      include: [
        { model: Venue, as: 'venue' }
      ]
    });

    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found or you do not have permission'
      });
    }

    // Ambil seats
    const seats = await Seat.findAll({
      where: { concertId },
      order: [['sectionId', 'ASC'], ['row', 'ASC'], ['number', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        concert,
        venue: concert.venue,
        seats
      }
    });
  } catch (error) {
    console.error('Error getting seat editor data:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get seat editor data'
    });
  }
};

// @desc    Update seat configuration
// @route   PUT /api/organizer/concerts/:id/seat-config
exports.updateSeatConfig = async (req, res) => {
  try {
    const concertId = req.params.id;
    const organizerId = req.user.id;
    const { config } = req.body;

    // Cek apakah concert milik organizer
    const concert = await Concert.findOne({
      where: { id: concertId, organizerId }
    });

    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found or you do not have permission'
      });
    }

    // Update venue seat config
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
      message: error.message || 'Failed to update seat configuration'
    });
  }
};