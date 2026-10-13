const { 
  User, 
  OrganizerProfile, 
  Concert, 
  Order, 
  Ticket, 
  TicketCategory,
  Payment, 
  Withdrawal, 
  Gallery, 
  Promotion, 
  Venue, 
  Category,
  Seat,
  Review,
  Artist,
  sequelize
} = require('../models');
const { Op, Sequelize } = require('sequelize');
const slugify = require('slugify');

const updateConcertPriceRange = async (concertId) => {
  const categories = await TicketCategory.findAll({
    where: { concertId, status: 'active' },
    attributes: ['price'],
    raw: true
  });
  const prices = categories.map((item) => Number(item.price)).filter(Number.isFinite);
  await Concert.update({
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0
  }, { where: { id: concertId } });
};

const normalizePromoData = (input, existing = {}) => {
  const field = (name) => input[name] === undefined ? existing[name] : input[name];
  const code = String(field('code') || '').trim().toUpperCase();
  const name = String(field('name') || '').trim();
  const type = field('type');
  const discountType = field('discountType') || 'percentage';
  const value = Number(field('value'));
  const startDate = new Date(field('startDate'));
  const endDate = new Date(field('endDate'));
  const maxUsesValue = field('maxUses');
  const perUserLimit = Number(field('perUserLimit') || 1);
  const minPurchaseValue = field('minPurchase');
  const maxDiscountValue = field('maxDiscount');
  const maxUses = maxUsesValue === undefined || maxUsesValue === null || maxUsesValue === '' ? null : Number(maxUsesValue);
  const minPurchase = minPurchaseValue === undefined || minPurchaseValue === null || minPurchaseValue === '' ? null : Number(minPurchaseValue);
  const maxDiscount = maxDiscountValue === undefined || maxDiscountValue === null || maxDiscountValue === '' ? null : Number(maxDiscountValue);

  if (!code || !name || !['voucher', 'discount', 'flash_sale', 'bundle'].includes(type) ||
    !['percentage', 'fixed'].includes(discountType) || !Number.isFinite(value) || value <= 0 ||
    (discountType === 'percentage' && value > 100) ||
    !Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate >= endDate ||
    (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) ||
    !Number.isInteger(perUserLimit) || perUserLimit < 1 ||
    (minPurchase !== null && (!Number.isFinite(minPurchase) || minPurchase < 0)) ||
    (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount < 0))) {
    const error = new Error('Promo details, discount, usage limits, or period are invalid');
    error.status = 400;
    throw error;
  }

  return {
    code,
    name,
    description: field('description') || null,
    type,
    value,
    discountType,
    minPurchase,
    maxDiscount,
    startDate,
    endDate,
    maxUses,
    perUserLimit
  };
};

// ==================== DASHBOARD ====================
exports.getDashboard = async (req, res) => {
  try {
    const organizerId = req.user.id;
    console.log('📊 Fetching organizer dashboard for:', organizerId);

    const totalConcerts = await Concert.count({ where: { organizerId } });
    const activeConcerts = await Concert.count({
      where: { organizerId, status: { [Op.in]: ['published', 'on_sale', 'upcoming'] } }
    });
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
      where: { status: { [Op.in]: ['active', 'used'] } },
      include: [{
        model: Order,
        as: 'order',
        where: { organizerId, status: 'paid' },
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
          activeConcerts: activeConcerts || 0,
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
    const {
      name,
      phone,
      companyName,
      description,
      website,
      instagram,
      youtube,
      city,
      address
    } = req.body;
    if (!String(companyName || '').trim() || !String(city || '').trim() || !String(address || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'Company name, city, and address are required'
      });
    }
    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Contact name cannot be empty' });
    }

    const profile = await sequelize.transaction(async (transaction) => {
      const organizerProfile = await OrganizerProfile.findOne({
        where: { userId: req.user.id },
        transaction
      });
      if (!organizerProfile) {
        const error = new Error('Organizer profile not found');
        error.status = 404;
        throw error;
      }

      const user = await User.findByPk(req.user.id, { transaction });
      if (!user) {
        const error = new Error('Organizer account not found');
        error.status = 404;
        throw error;
      }

      await organizerProfile.update({
        companyName: String(companyName).trim(),
        description: description ? String(description).trim() : null,
        website: website ? String(website).trim() : null,
        instagram: instagram ? String(instagram).trim() : null,
        youtube: youtube ? String(youtube).trim() : null,
        city: String(city).trim(),
        address: String(address).trim()
      }, { transaction });
      await user.update({
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(phone !== undefined ? { phone: String(phone).trim() || null } : {})
      }, { transaction });

      return OrganizerProfile.findOne({
        where: { userId: req.user.id },
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'avatar'] }],
        transaction
      });
    });

    res.json({
      success: true,
      data: profile,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(error.status || 500).json({
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

exports.getConcertById = async (req, res) => {
  try {
    const concert = await Concert.findOne({
      where: { id: req.params.id, organizerId: req.user.id },
      include: [
        { model: Venue, as: 'venue' },
        { model: Artist, as: 'artist' },
        { model: Category, as: 'category' }
      ]
    });
    if (!concert) return res.status(404).json({ success: false, message: 'Concert not found' });
    res.json({ success: true, data: concert });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
      startSale,
      endSale,
      sections,
      status
    } = req.body;

    const normalizedStatus = status === 'draft' ? 'draft' : 'pending';
    const saleStartDate = startSale ? new Date(startSale) : null;
    const saleEndDate = endSale ? new Date(endSale) : null;
    if ((saleStartDate && !Number.isFinite(saleStartDate.getTime())) ||
      (saleEndDate && !Number.isFinite(saleEndDate.getTime())) ||
      (saleStartDate && saleEndDate && saleStartDate >= saleEndDate)) {
      return res.status(400).json({ success: false, message: 'Ticket sale end must be later than its start' });
    }

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

    if (!Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one ticket section is required' });
    }

    const allowedCategories = ['vvip', 'vip', 'regular', 'platinum', 'diamond'];
    const ticketCategoryLabels = { vvip: 'VVIP', vip: 'VIP', regular: 'Regular', platinum: 'Platinum', diamond: 'Diamond' };
    const normalizedSections = sections.map((section, index) => {
      const price = Number(section.price);
      if (!section.name?.trim() || !allowedCategories.includes(section.category) || !Number.isFinite(price) || price < 0) {
        const error = new Error('Each section needs a name, valid category, and non-negative price');
        error.status = 400;
        throw error;
      }
      const isStanding = section.type === 'standing';
      const rows = isStanding ? 1 : Number(section.rows);
      const seatsPerRow = isStanding ? Number(section.capacity) : Number(section.seatsPerRow);
      if (!Number.isInteger(rows) || rows < 1 || !Number.isInteger(seatsPerRow) || seatsPerRow < 1) {
        const error = new Error('Each section needs a valid capacity or positive row/seat counts');
        error.status = 400;
        throw error;
      }
      return { ...section, id: section.id || `section-${index + 1}`, price, rows, seatsPerRow, isStanding };
    });
    const computedTotalTickets = normalizedSections.reduce((total, section) => total + section.rows * section.seatsPerRow, 0);
    const sectionPrices = normalizedSections.map((section) => section.price);

    // Generate seat map configuration
    const seatMapConfig = {
      sections: normalizedSections,
      stagePosition: 'front',
      totalSeats: computedTotalTickets
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
      minPrice: Math.min(...sectionPrices),
      maxPrice: Math.max(...sectionPrices),
      totalTickets: computedTotalTickets,
      availableTickets: computedTotalTickets,
      genre: genre || null,
      rules: rules || null,
      youtubeTrailer: youtubeTrailer || null,
      isFeatured: isFeatured || false,
      isFlashSale: isFlashSale || false,
      flashSalePrice: flashSalePrice || null,
      flashSaleEnd: flashSaleEnd || null,
      startSale: saleStartDate,
      endSale: saleEndDate,
      seatMapConfig: seatMapConfig,
      status: normalizedStatus
    };

    const concert = await sequelize.transaction(async (transaction) => {
      const createdConcert = await Concert.create(concertData, { transaction });
      const categories = new Map();
      const seats = [];
      normalizedSections.forEach((section, sectionIndex) => {
        const ticketCategoryName = ticketCategoryLabels[section.category];
        const current = categories.get(section.category) || { organizerId, concertId: createdConcert.id, category: ticketCategoryName, price: section.price, quota: 0, sold: 0, status: 'active' };
        current.price = Math.min(current.price, section.price);
        current.quota += section.rows * section.seatsPerRow;
        categories.set(section.category, current);

        for (let rowIndex = 0; rowIndex < section.rows; rowIndex++) {
          for (let seatIndex = 0; seatIndex < section.seatsPerRow; seatIndex++) {
            const isCircular = venueType === 'stadium' || venueType === 'arena';
            const sectionAngle = (sectionIndex / normalizedSections.length) * Math.PI * 2;
            const seatAngle = seatIndex * 0.025;
            const radius = 0.25 + (rowIndex / Math.max(section.rows, 1)) * 0.2;
            seats.push({
              concertId: createdConcert.id,
              venueId: createdConcert.venueId,
              sectionId: section.id,
              sectionName: section.name.trim(),
              row: section.isStanding ? 'STANDING' : String.fromCharCode(65 + rowIndex),
              number: seatIndex + 1,
              category: section.category,
              price: section.price,
              status: 'available',
              x: isCircular ? 0.5 + radius * Math.cos(sectionAngle + seatAngle) : 0.1 + (seatIndex / Math.max(section.seatsPerRow, 1)) * 0.8,
              y: isCircular ? 0.5 + radius * Math.sin(sectionAngle + seatAngle) : 0.15 + (rowIndex / Math.max(section.rows, 1)) * 0.75,
              rotation: isCircular ? sectionAngle + Math.PI / 2 : 0
            });
          }
        }
      });
      await TicketCategory.bulkCreate([...categories.values()], { transaction });
      await Seat.bulkCreate(seats, { transaction });
      return createdConcert;
    });

    res.status(201).json({
      success: true,
      data: concert,
      message: 'Concert created and submitted for moderation with ticket categories and seats'
    });
  } catch (error) {
    console.error('❌ Create concert error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to create concert'
    });
  }
};

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

    if (!['draft', 'pending', 'rejected'].includes(concert.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only draft, pending, or rejected concerts can be edited'
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
      genre,
      artistId,
      startSale,
      endSale
    } = req.body;

    const saleStartDate = startSale === undefined ? concert.startSale : (startSale ? new Date(startSale) : null);
    const saleEndDate = endSale === undefined ? concert.endSale : (endSale ? new Date(endSale) : null);
    if ((saleStartDate && !Number.isFinite(new Date(saleStartDate).getTime())) ||
      (saleEndDate && !Number.isFinite(new Date(saleEndDate).getTime())) ||
      (saleStartDate && saleEndDate && new Date(saleStartDate) >= new Date(saleEndDate))) {
      return res.status(400).json({ success: false, message: 'Ticket sale end must be later than its start' });
    }

    let updateData = {
      name: name || concert.name,
      description: description || concert.description,
      date: date || concert.date,
      time: time || concert.time,
      venueName: venueName || concert.venueName || '',
      city: city || concert.city || '',
      address: address || concert.address || '',
      startSale: saleStartDate,
      endSale: saleEndDate,
      venueId: venueId || concert.venueId || null,
      categoryId: categoryId || concert.categoryId || null,
      genre: genre || concert.genre || '',
      artistId: artistId === undefined ? concert.artistId : (artistId || null)
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

    if (!['draft', 'pending'].includes(concert.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only draft or pending concerts can be deleted'
      });
    }

    const orderCount = await Order.count({ where: { concertId: concert.id } });
    if (orderCount > 0) {
      return res.status(409).json({ success: false, message: 'Concerts with orders cannot be deleted' });
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

    if (concert.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Concert must be approved by an administrator before it can be published'
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

    await concert.update({ status: 'approved' });

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
    const tickets = await TicketCategory.findAll({
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

    res.json({
      success: true,
      data: tickets.map((ticket) => ({
        ...ticket.toJSON(),
        available: Math.max(0, ticket.quota - ticket.sold)
      }))
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

    const concert = await Concert.findOne({ where: { id: concertId, organizerId } });
    if (!concert) {
      return res.status(404).json({ success: false, message: 'Concert not found or not owned by you' });
    }
    if (!category || !Number.isFinite(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(quota)) || Number(quota) < 1) {
      return res.status(400).json({ success: false, message: 'Category, valid price, and positive quota are required' });
    }

    const ticket = await TicketCategory.create({
      organizerId,
      category,
      price: Number(price),
      quota: Number(quota),
      sold: 0,
      concertId
    });
    await updateConcertPriceRange(concertId);

    res.status(201).json({
      success: true,
      data: { ...ticket.toJSON(), available: ticket.quota },
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

    const ticket = await TicketCategory.findOne({
      where: { id, organizerId }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const nextQuota = quota === undefined ? ticket.quota : Number(quota);
    if (!Number.isInteger(nextQuota) || nextQuota < ticket.sold) {
      return res.status(400).json({ success: false, message: 'Quota cannot be less than tickets already sold' });
    }
    if (price !== undefined && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
      return res.status(400).json({ success: false, message: 'Price must be a non-negative number' });
    }

    await ticket.update({
      category: category || ticket.category,
      price: price === undefined ? ticket.price : Number(price),
      quota: nextQuota
    });
    await updateConcertPriceRange(ticket.concertId);

    res.json({
      success: true,
      data: { ...ticket.toJSON(), available: Math.max(0, ticket.quota - ticket.sold) },
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

    const ticket = await TicketCategory.findOne({
      where: { id, organizerId }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    if (ticket.sold > 0) {
      return res.status(409).json({ success: false, message: 'A category with sold tickets cannot be deleted' });
    }

    const concertId = ticket.concertId;
    await ticket.destroy();
    await updateConcertPriceRange(concertId);

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
    const imageUrl = req.file
      ? `/uploads/gallery/${req.file.filename}`
      : (typeof image === 'string' && /^https?:\/\//i.test(image.trim()) ? image.trim() : null);

    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'Upload an image file or provide a valid image URL' });
    }
    if (!['photo', 'poster', 'banner', 'video'].includes(type || 'photo')) {
      return res.status(400).json({ success: false, message: 'Unsupported gallery item type' });
    }

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
      image: imageUrl,
      caption: caption || null,
      type: type || 'photo',
      concertId: concert.id
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
    const promo = await Promotion.create({
      organizerId,
      ...normalizePromoData(req.body),
      status: 'active'
    });

    res.status(201).json({
      success: true,
      data: promo,
      message: 'Promo created successfully'
    });
  } catch (error) {
    console.error('❌ Create promo error:', error);
    res.status(error.status || (error.name === 'SequelizeUniqueConstraintError' ? 409 : 500)).json({
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

    await promo.update(normalizePromoData(req.body, promo));

    res.json({
      success: true,
      data: promo,
      message: 'Promo updated successfully'
    });
  } catch (error) {
    console.error('❌ Update promo error:', error);
    res.status(error.status || (error.name === 'SequelizeUniqueConstraintError' ? 409 : 500)).json({
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

    // Count only tickets belonging to paid orders.
    const [totalTicketsResult] = await sequelize.query(
      `SELECT COUNT(*) as total 
       FROM Tickets t
       INNER JOIN Orders o ON t.orderId = o.id
       INNER JOIN Concerts c ON t.concertId = c.id
       WHERE c.organizerId = ? AND o.status = 'paid' AND t.status IN ('active', 'used')`,
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
       INNER JOIN Orders o ON t.orderId = o.id AND o.status = 'paid'
       INNER JOIN Concerts c ON t.concertId = c.id
       WHERE c.organizerId = ? AND t.status IN ('active', 'used')
       GROUP BY t.category`,
      {
        replacements: [organizerId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    // Aggregate each metric independently to avoid join multiplication between tickets, orders, and reviews.
    const topConcerts = await sequelize.query(
      `SELECT 
        c.id,
        c.name,
        (SELECT COUNT(*)
         FROM Tickets t
         INNER JOIN Orders ticketOrder ON t.orderId = ticketOrder.id
         WHERE t.concertId = c.id AND ticketOrder.status = 'paid' AND t.status IN ('active', 'used')) as tickets,
        (SELECT COALESCE(SUM(o.totalAmount), 0)
         FROM Orders o
         WHERE o.concertId = c.id AND o.status = 'paid') as revenue,
        (SELECT COALESCE(AVG(r.rating), 0)
         FROM Reviews r
         WHERE r.concertId = c.id) as rating
       FROM Concerts c
       WHERE c.organizerId = ?
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
    const requestedAmount = Number(amount);

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Withdrawal amount must be greater than zero' });
    }

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

    const available = Math.max(0, Number(totalRevenue || 0) - Number(totalWithdrawn || 0));

    if (requestedAmount > available) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: Rp ${available.toLocaleString()}`
      });
    }

    const resolvedBankName = bankName || profile.bankName;
    const resolvedBankAccount = bankAccount || profile.bankAccount;
    const resolvedBankHolder = bankHolder || profile.bankHolder;
    if (!resolvedBankName || !resolvedBankAccount || !resolvedBankHolder) {
      return res.status(400).json({ success: false, message: 'Bank name, account number, and account holder are required' });
    }

    const withdrawal = await Withdrawal.create({
      organizerId: req.user.id,
      amount: requestedAmount,
      bankName: resolvedBankName,
      bankAccount: resolvedBankAccount,
      bankHolder: resolvedBankHolder,
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

exports.getWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.findAll({
      where: { organizerId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, data: withdrawals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.cancelWithdrawal = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findOne({
      where: { id: req.params.id, organizerId: req.user.id }
    });
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending withdrawals can be cancelled' });
    }
    await withdrawal.update({ status: 'cancelled' });
    res.json({ success: true, data: withdrawal });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

exports.submitConcertForApproval = async (req, res) => {
  try {
    const concert = await Concert.findOne({ where: { id: req.params.id, organizerId: req.user.id } });
    if (!concert) return res.status(404).json({ success: false, message: 'Concert not found' });
    if (!['draft', 'rejected'].includes(concert.status)) {
      return res.status(400).json({ success: false, message: 'Only draft or rejected concerts can be submitted' });
    }
    await concert.update({ status: 'pending' });
    res.json({ success: true, data: concert, message: 'Concert submitted for moderation' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};