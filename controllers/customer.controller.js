const { 
  User, 
  Order, 
  Ticket, 
  Concert, 
  Favorite, 
  Review, 
  Venue, 
  Artist, 
  Payment, 
  OrganizerProfile,
  Category,
  Seat,
  Gallery
} = require('../models');
const { Op, Sequelize } = require('sequelize');
const PDFDocument = require('pdfkit');
const { ensureTicketQr } = require('../utils/ticketQr');

// ==================== DASHBOARD ====================
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📊 Fetching dashboard for user:', userId);

    // Ambil concert yang sudah published
    const publishedConcerts = await Concert.findAll({
      where: {
        status: { [Op.in]: ['published', 'on_sale'] }
      },
      attributes: ['id', 'name', 'slug', 'date', 'time', 'venueName', 'city', 'address', 
                   'minPrice', 'maxPrice', 'totalTickets', 'availableTickets', 'soldTickets',
                   'status', 'isFeatured', 'isFlashSale', 'thumbnail', 'genre'],
      include: [
        { 
          model: Venue, 
          as: 'venue',
          attributes: ['id', 'name', 'city', 'address']
        },
        { 
          model: User, 
          as: 'organizer',
          attributes: ['id', 'name']
        },
        {
          model: Gallery,
          as: 'concertGalleries',
          attributes: ['id', 'image', 'type'],
          separate: true,
          order: [['createdAt', 'DESC']],
          limit: 10
        }
      ],
      order: [['date', 'ASC']],
      limit: 10
    });

    console.log('✅ Published concerts found:', publishedConcerts.length);

    // Total tickets dari order user
    const orders = await Order.findAll({
      where: { userId },
      include: [
        { 
          model: Ticket, 
          as: 'orderTickets',
          attributes: ['id', 'concertId', 'status', 'price']
        }
      ]
    });

    let totalTickets = 0;
    const upcomingEvents = [];

    for (const order of orders) {
      if (order.status !== 'paid') continue;
      if (order.orderTickets && order.orderTickets.length > 0) {
        totalTickets += order.orderTickets.filter((ticket) => ['active', 'used'].includes(ticket.status)).length;
        for (const ticket of order.orderTickets) {
          if (ticket.status === 'active') {
            const concert = await Concert.findByPk(ticket.concertId, {
              attributes: ['id', 'name', 'slug', 'date', 'time', 'venueName', 'thumbnail'],
              include: [
                { model: Venue, as: 'venue', attributes: ['id', 'name', 'city'] },
                { model: Artist, as: 'artist', attributes: ['id', 'name'] }
              ]
            });
            if (concert && new Date(concert.date) >= new Date()) {
              upcomingEvents.push({
                id: ticket.id,
                concertId: ticket.concertId,
                concert: concert
              });
            }
          }
        }
      }
    }

    // Wishlist count
    const wishlistCount = await Favorite.count({
      where: { userId }
    });

    // Total spent
    let totalSpent = 0;
    const payments = await Payment.findAll({
      where: { status: 'completed' },
      include: [
        {
          model: Order,
          as: 'order',
          where: { userId },
          required: true,
          attributes: ['id']
        }
      ]
    });

    for (const payment of payments) {
      totalSpent += parseFloat(payment.amount) || 0;
    }

    // Recent orders
    const recentOrders = await Order.findAll({
      where: { userId },
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [
        { 
          model: Concert, 
          as: 'concert', 
          attributes: ['id', 'name', 'date', 'thumbnail', 'slug'] 
        }
      ]
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalTickets: totalTickets || 0,
          upcomingEvents: upcomingEvents.length || 0,
          wishlist: wishlistCount || 0,
          totalSpent: totalSpent || 0
        },
        upcomingEvents: upcomingEvents.map(item => ({
          id: item.id,
          concertId: item.concertId,
          concert: item.concert ? {
            id: item.concert.id,
            name: item.concert.name,
            slug: item.concert.slug,
            date: item.concert.date,
            venue: item.concert.venue,
            artist: item.concert.artist,
            thumbnail: item.concert.thumbnail
          } : null
        })),
        recentOrders: recentOrders,
        publishedConcerts: publishedConcerts
      }
    });
  } catch (error) {
    console.error('❌ Customer dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch dashboard data'
    });
  }
};

// ==================== PROFILE ====================
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findByPk(userId, {
      attributes: { 
        exclude: ['password', 'refreshToken', 'resetPasswordToken', 'resetPasswordExpire'] 
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Hitung statistik untuk profile
    const totalTickets = await Ticket.count({
      include: [{
        model: Order,
        as: 'order',
        where: { userId },
        required: true
      }]
    });

    const upcomingEvents = await Ticket.count({
      include: [
        {
          model: Order,
          as: 'order',
          where: { userId },
          required: true
        },
        {
          model: Concert,
          as: 'concert',
          where: { date: { [Op.gte]: new Date() } },
          required: true
        }
      ],
      where: { status: 'active' }
    });

    const wishlistCount = await Favorite.count({
      where: { userId }
    });

    res.json({
      success: true,
      data: {
        ...user.toJSON(),
        totalTickets,
        upcomingEvents,
        wishlistCount
      }
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
    const {
      name, phone, bio, dateOfBirth, gender, address, city, country,
      currentPassword, newPassword
    } = req.body;
    
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const changingPassword = Boolean(currentPassword || newPassword);
    if (changingPassword) {
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }
      if (String(newPassword).length < 8) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 8 characters'
        });
      }
      if (!(await user.comparePassword(currentPassword))) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
    }

    await user.update({
      name: name?.trim() || user.name,
      phone: phone ?? user.phone,
      bio: bio ?? user.bio,
      dateOfBirth: dateOfBirth ?? user.dateOfBirth,
      gender: gender ?? user.gender,
      address: address ?? user.address,
      city: city ?? user.city,
      country: country ?? user.country,
      ...(changingPassword ? { password: newPassword } : {})
    });

    const updatedUser = user.toJSON();
    delete updatedUser.password;
    delete updatedUser.refreshToken;
    delete updatedUser.resetPasswordToken;
    delete updatedUser.resetPasswordExpire;

    res.json({
      success: true,
      data: updatedUser,
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

// ==================== ORDERS ====================
exports.getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const where = { userId };

    if (status && status !== 'all') where.status = status;

    console.log('📦 Fetching orders for user:', userId);

    const orders = await Order.findAndCountAll({
      where,
      include: [
        { 
          model: Concert, 
          as: 'concert', 
          attributes: ['id', 'name', 'date', 'thumbnail', 'slug', 'venueId'],
          include: [
            { model: Venue, as: 'venue', attributes: ['id', 'name', 'city'] },
            { model: Artist, as: 'artist', attributes: ['id', 'name'] }
          ]
        },
        { 
          model: Ticket, 
          as: 'orderTickets',
          attributes: ['id', 'ticketNumber', 'price', 'status', 'seatId']
        },
        { 
          model: Payment, 
          as: 'orderPayment',
          attributes: ['id', 'amount', 'method', 'status', 'paidAt']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    console.log(`✅ Found ${orders.count} orders for user ${userId}`);

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

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [
        {
          model: Concert,
          as: 'concert',
          include: [
            { model: Venue, as: 'venue' },
            { model: Artist, as: 'artist' }
          ]
        },
        {
          model: Ticket,
          as: 'orderTickets',
          include: [{ model: Seat, as: 'seat' }]
        },
        { model: Payment, as: 'orderPayment' }
      ]
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status === 'paid') {
      for (const ticket of order.orderTickets || []) {
        if (['active', 'used'].includes(ticket.status)) {
          await ensureTicketQr(ticket);
        }
      }
    }

    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Get order detail error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== TICKETS ====================
exports.getTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    console.log('🎫 Fetching tickets for user:', userId);

    // Cari semua order dari user
    const orders = await Order.findAll({
      where: { userId, status: 'paid' },
      attributes: ['id']
    });

    const orderIds = orders.map(o => o.id);

    if (orderIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          totalPages: 0
        }
      });
    }

    const where = { orderId: { [Op.in]: orderIds } };
    if (status) where.status = status;

    const tickets = await Ticket.findAndCountAll({
      where,
      include: [
        { 
          model: Concert, 
          as: 'concert',
          attributes: ['id', 'name', 'date', 'time', 'thumbnail', 'slug', 'venueId', 'venueName', 'city', 'address'],
          include: [
            { model: Venue, as: 'venue', attributes: ['id', 'name', 'city', 'address'] },
            { model: Artist, as: 'artist', attributes: ['id', 'name'] }
          ]
        },
        { 
          model: Order, 
          as: 'order',
          attributes: ['id', 'orderNumber', 'totalAmount', 'status', 'paymentMethod']
        },
        { 
          model: Seat, 
          as: 'seat',
          attributes: ['id', 'number', 'category', 'row', 'sectionName']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    for (const ticket of tickets.rows) {
      if (['active', 'used'].includes(ticket.status)) {
        await ensureTicketQr(ticket);
      }
    }

    console.log(`✅ Found ${tickets.count} tickets for user ${userId}`);

    res.json({
      success: true,
      data: tickets.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: tickets.count,
        totalPages: Math.ceil(tickets.count / limit)
      }
    });
  } catch (error) {
    console.error('❌ Get tickets error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch tickets'
    });
  }
};

// @desc    Get ticket detail by ID
// @route   GET /api/customer/tickets/:id
exports.getTicketById = async (req, res) => {
  try {
    const userId = req.user.id;
    const ticketId = req.params.id;

    const ticket = await Ticket.findOne({
      where: { id: ticketId },
      include: [
        { 
          model: Concert, 
          as: 'concert',
          include: [
            { model: Venue, as: 'venue' },
            { model: Artist, as: 'artist' }
          ]
        },
        { 
          model: Order, 
          as: 'order',
          where: { userId }
        },
        { 
          model: Seat, 
          as: 'seat'
        }
      ]
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('❌ Get ticket detail error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getTicketQr = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({
      where: { id: req.params.id },
      include: [
        { model: Order, as: 'order', where: { userId: req.user.id } },
        { model: Seat, as: 'seat' }
      ]
    });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    if (ticket.order.status !== 'paid' || !['active', 'used'].includes(ticket.status)) {
      return res.status(409).json({ success: false, message: 'QR is available only for paid tickets' });
    }

    const qrCode = await ensureTicketQr(ticket);
    return res.json({ success: true, data: { ticketNumber: ticket.ticketNumber, qrCode, status: ticket.status } });
  } catch (error) {
    console.error('Get ticket QR error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const streamTicketPdf = async (order, tickets, res) => {
  for (const ticket of tickets) await ensureTicketQr(ticket);

  const filename = `e-ticket-${order.orderNumber}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const document = new PDFDocument({ size: 'A4', margin: 48 });
  document.pipe(res);
  tickets.forEach((ticket, index) => {
    if (index > 0) document.addPage();
    const concert = ticket.concert || order.concert;
    document.fontSize(22).text(concert?.name || 'Concert ticket', { align: 'center' });
    document.moveDown(0.5).fontSize(12).text(`Ticket: ${ticket.ticketNumber || '-'}`, { align: 'center' });
    document.moveDown(1.5);
    const qrImage = Buffer.from(ticket.qrCode.replace(/^data:image\/png;base64,/, ''), 'base64');
    const qrTop = document.y;
    document.image(qrImage, (document.page.width - 190) / 2, qrTop, { width: 190, height: 190 });
    document.y = qrTop + 210;
    document.fontSize(12).text(`Customer: ${order.customerName || '-'}`);
    document.text(`Date: ${concert?.date ? new Date(concert.date).toLocaleString('id-ID') : '-'}`);
    document.text(`Venue: ${concert?.venue?.name || concert?.venueName || '-'}`);
    document.text(`Seat: ${ticket.seat ? `${ticket.seat.row}-${ticket.seat.number}` : ticket.category}`);
    document.text(`Order: ${order.orderNumber}`);
    document.text(`Status: ${ticket.status.toUpperCase()}`);
    document.moveDown().fontSize(9).fillColor('#666').text('Valid only for the event and seat printed on this ticket.');
    document.fillColor('#000');
  });
  document.end();
};

exports.downloadOrderTicketsPdf = async (req, res) => {
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [
        { model: Concert, as: 'concert', include: [{ model: Venue, as: 'venue' }] },
        { model: Ticket, as: 'orderTickets', include: [{ model: Seat, as: 'seat' }, { model: Concert, as: 'concert' }] }
      ]
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status !== 'paid') return res.status(409).json({ success: false, message: 'E-ticket is available only after payment' });
    return await streamTicketPdf(order, order.orderTickets || [], res);
  } catch (error) {
    console.error('Download order tickets error:', error);
    if (!res.headersSent) return res.status(500).json({ success: false, message: error.message });
  }
};

exports.downloadTicketPdf = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({
      where: { id: req.params.id },
      include: [
        { model: Order, as: 'order', where: { userId: req.user.id } },
        { model: Seat, as: 'seat' },
        { model: Concert, as: 'concert', include: [{ model: Venue, as: 'venue' }] }
      ]
    });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    if (ticket.order.status !== 'paid') return res.status(409).json({ success: false, message: 'E-ticket is available only after payment' });
    const order = await Order.findByPk(ticket.orderId, { include: [{ model: Concert, as: 'concert', include: [{ model: Venue, as: 'venue' }] }] });
    return await streamTicketPdf(order, [ticket], res);
  } catch (error) {
    console.error('Download ticket error:', error);
    if (!res.headersSent) return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Publish Concert (Organizer)
// @route   POST /api/organizer/concerts/:id/publish
exports.publishConcert = async (req, res) => {
  try {
    const concertId = req.params.id;
    const organizerId = req.user.id;

    // Cek apakah concert milik organizer ini
    const concert = await Concert.findOne({
      where: { id: concertId, organizerId }
    });

    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    // Cek status
    if (concert.status === 'published') {
      return res.status(400).json({
        success: false,
        message: 'Concert is already published'
      });
    }

    // Update status ke published
    await concert.update({ 
      status: 'published'
    });

    res.json({
      success: true,
      data: concert,
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

// ==================== FAVORITES ====================
exports.getFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.findAll({
      where: { userId: req.user.id },
      include: [
        { 
          model: Concert,
          as: 'concert',
          include: [
            { model: Venue, as: 'venue' },
            { model: Artist, as: 'artist' }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: favorites
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.addFavorite = async (req, res) => {
  try {
    const concertId = req.params.concertId;
    
    const concert = await Concert.findByPk(concertId);
    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    const existing = await Favorite.findOne({
      where: { userId: req.user.id, concertId }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Concert already in favorites'
      });
    }

    const favorite = await Favorite.create({
      userId: req.user.id,
      concertId
    });

    res.status(201).json({
      success: true,
      data: favorite,
      message: 'Added to favorites'
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.removeFavorite = async (req, res) => {
  try {
    const favorite = await Favorite.findOne({
      where: {
        userId: req.user.id,
        concertId: req.params.concertId
      }
    });

    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: 'Favorite not found'
      });
    }

    await favorite.destroy();

    res.json({
      success: true,
      message: 'Removed from favorites'
    });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== WISHLIST ====================
// ==================== WISHLIST ====================
exports.getWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📊 Fetching wishlist for user:', userId);

    const wishlist = await Favorite.findAll({
      where: { userId },
      include: [
        { 
          model: Concert,
          as: 'concert',
          include: [
            { model: Venue, as: 'venue' },
            { model: Artist, as: 'artist' },
            { model: User, as: 'organizer', attributes: ['id', 'name'] },
            {
              model: Gallery,
              as: 'concertGalleries',
              attributes: ['id', 'image', 'type']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: wishlist
    });
  } catch (error) {
    console.error('❌ Get wishlist error:', error);
    console.error('📚 Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch wishlist'
    });
  }
};

// ==================== REVIEWS ====================
exports.createReview = async (req, res) => {
  try {
    const { concertId, rating, comment, title } = req.body;
    const numericRating = Number(rating);

    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }
    if ((req.files || []).length > 5) {
      return res.status(400).json({ success: false, message: 'A maximum of five review images is allowed' });
    }

    const concert = await Concert.findByPk(concertId);
    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    // Only attendees with a paid order and a scanned ticket may review.
    const hasTicket = await Ticket.findOne({
      where: {
        concertId,
        status: 'used'
      },
      include: [{
        model: Order,
        as: 'order',
        where: { userId: req.user.id, status: 'paid' },
        required: true
      }]
    });

    if (!hasTicket) {
      return res.status(403).json({
        success: false,
        message: 'You can only review concerts you have attended'
      });
    }

    // Check if already reviewed
    const existingReview = await Review.findOne({
      where: {
        userId: req.user.id,
        concertId: concertId
      }
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this concert'
      });
    }

    const review = await Review.create({
      userId: req.user.id,
      concertId,
      rating: numericRating,
      comment,
      title,
      images: (req.files || []).map((file) => `/uploads/gallery/${file.filename}`),
      isVerified: true
    });

    res.status(201).json({
      success: true,
      data: review,
      message: 'Review created successfully'
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const review = await Review.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    if (Date.now() - new Date(review.createdAt).getTime() > 24 * 60 * 60 * 1000) {
      return res.status(400).json({ success: false, message: 'Reviews can only be edited within 24 hours' });
    }
    if ((req.files || []).length > 5) {
      return res.status(400).json({ success: false, message: 'A maximum of five review images is allowed' });
    }

    const update = {};
    if (req.body.rating !== undefined) {
      const rating = Number(req.body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
      }
      update.rating = rating;
    }
    if (req.body.title !== undefined) update.title = req.body.title;
    if (req.body.comment !== undefined) update.comment = req.body.comment;
    if ((req.files || []).length) update.images = req.files.map((file) => `/uploads/gallery/${file.filename}`);
    await review.update(update);
    res.json({ success: true, data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    await review.destroy();
    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getReviews = async (req, res) => {
  try {
    const reviews = await Review.findAll({
      where: { userId: req.user.id },
      include: [
        { model: Concert, as: 'concert', attributes: ['id', 'name', 'thumbnail'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: reviews
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
