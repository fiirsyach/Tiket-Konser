// controllers/concert.controller.js
const { Concert, Artist, Venue, Category, Seat, Ticket, TicketCategory, Order, Review, User, Gallery } = require('../models');
const { Op } = require('sequelize');
const slugify = require('slugify');

const findConcertByIdentifier = (identifier, options = {}) => {
  const value = String(identifier);
  const where = /^\d+$/.test(value) ? { id: Number(value) } : { slug: value };
  return Concert.findOne({ ...options, where });
};

const publicGalleryInclude = () => ({
  model: Gallery,
  as: 'concertGalleries',
  attributes: ['id', 'image', 'type'],
  separate: true,
  order: [['createdAt', 'DESC']],
  limit: 10
});

// ==================== GET ALL CONCERTS ====================
exports.getConcerts = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sort = 'date',
      order = 'ASC',
      artist,
      city,
      venue,
      date,
      genre,
      category,
      minPrice,
      maxPrice,
      status
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Filters
    if (artist) where.ArtistId = artist;
    if (genre) where.genre = genre;
    if (status) where.status = status;
    if (category) where.CategoryId = category;
    if (minPrice) where.minPrice = { [Op.gte]: minPrice };
    if (maxPrice) where.maxPrice = { [Op.lte]: maxPrice };
    if (date) {
      const dateObj = new Date(date);
      where.date = {
        [Op.gte]: dateObj,
        [Op.lt]: new Date(dateObj.setDate(dateObj.getDate() + 1))
      };
    }

    // Venue filter
    if (city || venue) {
      const venueWhere = {};
      if (city) venueWhere.city = { [Op.like]: `%${city}%` };
      if (venue) venueWhere.name = { [Op.like]: `%${venue}%` };
      
      const venues = await Venue.findAll({ where: venueWhere });
      where.VenueId = venues.map(v => v.id);
    }

    const concerts = await Concert.findAndCountAll({
      where,
      include: [
        { model: Artist, as: 'artist' },
        { model: Venue, as: 'venue' },
        { model: Category, as: 'category' },
        publicGalleryInclude(),
        { 
          model: Review,
          as: 'concertReviews',
          attributes: ['rating']
        }
      ],
      order: [[sort, order]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    // Calculate average rating
    const concertsWithRating = concerts.rows.map(concert => {
      const reviews = concert.Reviews || [];
      const avgRating = reviews.length > 0 
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
        : 0;
      
      return {
        ...concert.toJSON(),
        averageRating: avgRating,
        Reviews: undefined
      };
    });

    res.json({
      success: true,
      data: concertsWithRating,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: concerts.count,
        totalPages: Math.ceil(concerts.count / limit)
      }
    });
  } catch (error) {
    console.error('❌ Get concerts error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== GET SINGLE CONCERT BY ID ====================
// @desc    Get single concert by ID
// @route   GET /api/concerts/:id
exports.getConcert = async (req, res) => {
  try {
    const identifier = req.params.id;
    console.log('🔍 Fetching concert by identifier:', identifier);

    // STEP 1: Cek apakah concert ada
    const concert = await findConcertByIdentifier(identifier);
    
    if (!concert) {
      console.log('❌ Concert not found with identifier:', identifier);
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }
    const concertId = concert.id;

    if (!['published', 'on_sale', 'upcoming'].includes(concert.status)) {
      return res.status(404).json({ success: false, message: 'Concert not found' });
    }

    console.log('✅ Concert found:', concert.name);
    console.log('📝 Concert data:', {
      id: concert.id,
      name: concert.name,
      venueType: concert.venueType,
      venueName: concert.venueName,
      hasSeatMapConfig: !!concert.seatMapConfig
    });

    // STEP 2: Increment views
    try {
      concert.views = (concert.views || 0) + 1;
      await concert.save();
    } catch (saveError) {
      console.log('⚠️ Failed to increment views:', saveError.message);
    }

    // STEP 3: Ambil data dengan include - SATU PER SATU untuk debugging
    let artist = null;
    let venue = null;
    let category = null;
    let reviews = [];
    let organizer = null;
    let seats = [];
    let galleries = [];

    try {
      // Ambil artist
      const artistData = await Artist.findByPk(concert.artistId, {
        attributes: ['id', 'name', 'photo', 'genre']
      });
      if (artistData) artist = artistData;
    } catch (e) {
      console.log('⚠️ Error fetching artist:', e.message);
    }

    try {
      // Ambil venue
      const venueData = await Venue.findByPk(concert.venueId, {
        attributes: ['id', 'name', 'city', 'address', 'type', 'seatConfig']
      });
      if (venueData) venue = venueData;
    } catch (e) {
      console.log('⚠️ Error fetching venue:', e.message);
    }

    try {
      // Ambil category
      const categoryData = await Category.findByPk(concert.categoryId, {
        attributes: ['id', 'name']
      });
      if (categoryData) category = categoryData;
    } catch (e) {
      console.log('⚠️ Error fetching category:', e.message);
    }

    try {
      // Ambil reviews
      reviews = await Review.findAll({
        where: { concertId, status: 'approved' },
        include: [
          { 
            model: User, 
            as: 'reviewer', 
            attributes: ['id', 'name', 'avatar'] 
          }
        ],
        limit: 10
      });
    } catch (e) {
      console.log('⚠️ Error fetching reviews:', e.message);
    }

    try {
      // Ambil organizer
      const organizerData = await User.findByPk(concert.organizerId, {
        attributes: ['id', 'name', 'email', 'avatar']
      });
      if (organizerData) organizer = organizerData;
    } catch (e) {
      console.log('⚠️ Error fetching organizer:', e.message);
    }

    try {
      // Ambil seats
      seats = await Seat.findAll({
        where: { concertId, status: 'available' },
        attributes: ['id', 'number', 'row', 'category', 'price', 'status', 'sectionId', 'sectionName'],
        limit: 100
      });
    } catch (e) {
      console.log('⚠️ Error fetching seats:', e.message);
    }

    try {
      // Ambil galleries
      galleries = await Gallery.findAll({
        where: { concertId },
        limit: 10
      });
    } catch (e) {
      console.log('⚠️ Error fetching galleries:', e.message);
    }

    // STEP 4: Build response
    const concertData = concert.toJSON();
    const dateLabel = concertData.date
      ? new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta'
      }).format(new Date(concertData.date))
      : null;
    
    const responseData = {
      ...concertData,
      dateLabel,
      artist: artist,
      venue: venue,
      category: category,
      concertReviews: reviews,
      organizer: organizer,
      concertSeats: seats,
      concertGalleries: galleries,
      venueType: concertData.venueType || 'hall',
      venueName: concertData.venueName || 'Unknown Venue',
      seatMapConfig: concertData.seatMapConfig || { 
        sections: [], 
        stagePosition: 'front', 
        totalSeats: concertData.totalTickets || 0 
      },
      totalTickets: concertData.totalTickets || 0,
      soldTickets: concertData.soldTickets || 0,
      availableTickets: concertData.availableTickets || 0,
      minPrice: concertData.minPrice || 0,
      maxPrice: concertData.maxPrice || 0,
      averageRating: 0,
      availableSeats: seats.length || 0
    };

    // Calculate average rating
    if (reviews && reviews.length > 0) {
      const avg = reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length;
      responseData.averageRating = Math.round(avg * 10) / 10;
    }

    console.log('✅ Sending response for concert:', concertId);
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('❌ Get concert by ID error:', error);
    console.error('📚 Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch concert',
      error: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
};

exports.getTicketCategories = async (req, res) => {
  try {
    const concert = await findConcertByIdentifier(req.params.id, {
      attributes: ['id', 'status']
    });
    if (!concert || !['published', 'on_sale', 'upcoming'].includes(concert.status)) {
      return res.status(404).json({ success: false, message: 'Concert not found' });
    }

    const categories = await TicketCategory.findAll({
      where: { concertId: concert.id, status: 'active' },
      attributes: ['id', 'category', 'description', 'price', 'quota', 'sold'],
      order: [['price', 'ASC']]
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get concert ticket categories error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET FEATURED CONCERTS ====================
exports.getFeaturedConcerts = async (req, res) => {
  try {
    const concerts = await Concert.findAll({
      where: {
        isFeatured: true,
        status: { [Op.in]: ['published', 'on_sale', 'upcoming'] }
      },
      include: [{ model: Artist, as: 'artist' }, { model: Venue, as: 'venue' }, publicGalleryInclude()],
      limit: 10,
      order: [['date', 'ASC']]
    });

    res.json({
      success: true,
      data: concerts
    });
  } catch (error) {
    console.error('❌ Get featured concerts error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== GET PUBLISHED CONCERTS ====================
exports.getPublishedConcerts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, genre, city, date } = req.query;
    const offset = (page - 1) * limit;
    const where = {
      status: { [Op.in]: ['published', 'on_sale', 'upcoming'] }
    };

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    if (genre) where.genre = genre;
    if (date) {
      const dateObj = new Date(date);
      where.date = {
        [Op.gte]: dateObj,
        [Op.lt]: new Date(dateObj.setDate(dateObj.getDate() + 1))
      };
    }

    // Filter venue jika ada city
    if (city) {
      const venues = await Venue.findAll({ 
        where: { city: { [Op.like]: `%${city}%` } } 
      });
      where.venueId = venues.map(v => v.id);
    }

    const concerts = await Concert.findAndCountAll({
      where,
      include: [
        { model: Venue, as: 'venue' },
        { model: Artist, as: 'artist' },
        publicGalleryInclude(),
        { 
          model: User, 
          as: 'organizer',
          attributes: ['id', 'name']
        },
        { model: Category, as: 'category' }
      ],
      order: [['date', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: concerts.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: concerts.count,
        totalPages: Math.ceil(concerts.count / limit)
      }
    });
  } catch (error) {
    console.error('❌ Get published concerts error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch concerts'
    });
  }
};

// ==================== GET UPCOMING CONCERTS ====================
exports.getUpcomingConcerts = async (req, res) => {
  try {
    const concerts = await Concert.findAll({
      where: {
        status: { [Op.in]: ['published', 'on_sale', 'upcoming'] },
        date: { [Op.gt]: new Date() }
      },
      include: [{ model: Artist, as: 'artist' }, { model: Venue, as: 'venue' }, publicGalleryInclude()],
      limit: 20,
      order: [['date', 'ASC']]
    });

    res.json({
      success: true,
      data: concerts
    });
  } catch (error) {
    console.error('❌ Get upcoming concerts error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== GET FLASH SALE CONCERTS ====================
exports.getFlashSaleConcerts = async (req, res) => {
  try {
    const concerts = await Concert.findAll({
      where: {
        isFlashSale: true,
        flashSaleEnd: { [Op.gt]: new Date() },
        status: { [Op.in]: ['published', 'on_sale', 'upcoming'] }
      },
      include: [{ model: Artist, as: 'artist' }, { model: Venue, as: 'venue' }, publicGalleryInclude()],
      limit: 10,
      order: [['flashSaleEnd', 'ASC']]
    });

    res.json({
      success: true,
      data: concerts
    });
  } catch (error) {
    console.error('❌ Get flash sale concerts error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== SEARCH CONCERTS ====================
exports.searchConcerts = async (req, res) => {
  try {
    const { q, city, date, genre, page = 1, limit = 20, sort = 'date', order = 'ASC' } = req.query;
    const query = String(q || '').trim();
    const cityFilter = String(city || '').trim();
    const genreFilter = String(genre || '').trim();
    
    if (!query && !cityFilter && !date && !genreFilter) {
      return res.status(400).json({
        success: false,
        message: 'Provide a search term or at least one concert filter'
      });
    }
    const parsedCalendarDate = date && /^\d{4}-\d{2}-\d{2}$/.test(String(date))
      ? new Date(`${date}T00:00:00.000Z`)
      : null;
    if (date && (!parsedCalendarDate || Number.isNaN(parsedCalendarDate.getTime()) || parsedCalendarDate.toISOString().slice(0, 10) !== date)) {
      return res.status(400).json({ success: false, message: 'Date filter must use a valid YYYY-MM-DD date' });
    }

    const safeSort = ['date', 'createdAt', 'views', 'minPrice'].includes(sort) ? sort : 'date';
    const safeOrder = String(order).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const filters = [
      { status: { [Op.in]: ['published', 'on_sale', 'upcoming'] } }
    ];
    if (query) {
      filters.push({
        [Op.or]: [
          { name: { [Op.like]: `%${query}%` } },
          { description: { [Op.like]: `%${query}%` } },
          { genre: { [Op.like]: `%${query}%` } },
          { '$artist.name$': { [Op.like]: `%${query}%` } },
          { '$venue.name$': { [Op.like]: `%${query}%` } },
          { '$venue.city$': { [Op.like]: `%${query}%` } }
        ]
      });
    }
    if (cityFilter) filters.push({ '$venue.city$': { [Op.like]: `%${cityFilter}%` } });
    if (genreFilter) filters.push({ genre: { [Op.like]: `%${genreFilter}%` } });
    if (date) {
      const nextCalendarDate = new Date(parsedCalendarDate);
      nextCalendarDate.setUTCDate(nextCalendarDate.getUTCDate() + 1);
      const startDate = new Date(`${date}T00:00:00+07:00`);
      const endDate = new Date(`${nextCalendarDate.toISOString().slice(0, 10)}T00:00:00+07:00`);
      filters.push({ date: { [Op.gte]: startDate, [Op.lt]: endDate } });
    }

    const concerts = await Concert.findAndCountAll({
      where: { [Op.and]: filters },
      include: [
        { model: Artist, as: 'artist', required: false },
        { model: Venue, as: 'venue', required: false },
        publicGalleryInclude()
      ],
      order: [[safeSort, safeOrder]],
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
      distinct: true
    });

    res.json({
      success: true,
      data: concerts.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: concerts.count,
        totalPages: Math.ceil(concerts.count / safeLimit)
      }
    });
  } catch (error) {
    console.error('❌ Search concerts error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getConcertReviews = async (req, res) => {
  try {
    const concert = await findConcertByIdentifier(req.params.id, { attributes: ['id'] });
    if (!concert) return res.status(404).json({ success: false, message: 'Concert not found' });

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const result = await Review.findAndCountAll({
      where: { concertId: concert.id, status: 'approved' },
      include: [{ model: User, as: 'reviewer', attributes: ['id', 'name', 'avatar'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit
    });
    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total: result.count, totalPages: Math.ceil(result.count / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET CONCERTS BY ARTIST ====================
exports.getConcertsByArtist = async (req, res) => {
  try {
    const concerts = await Concert.findAll({
      where: { ArtistId: req.params.artistId },
      include: [{ model: Artist, as: 'artist' }, { model: Venue, as: 'venue' }, publicGalleryInclude()],
      order: [['date', 'DESC']]
    });

    res.json({
      success: true,
      data: concerts
    });
  } catch (error) {
    console.error('❌ Get concerts by artist error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== GET CONCERT SEATS ====================
// @desc    Get concert seats
// @route   GET /api/concerts/:id/seats
exports.getConcertSeats = async (req, res) => {
  try {
    const identifier = req.params.id;
    console.log('🔍 Fetching seats for concert:', identifier);

    // Cek apakah concert ada
    const concert = await findConcertByIdentifier(identifier, {
      attributes: ['id', 'name', 'date', 'venueType', 'venueName', 'seatMapConfig', 'totalTickets', 'status']
    });
    
    if (!concert) {
      console.log('❌ Concert not found for seats:', identifier);
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }
    const concertId = concert.id;

    if (!['published', 'on_sale', 'upcoming'].includes(concert.status)) {
      return res.status(404).json({ success: false, message: 'Concert not found' });
    }

    console.log('✅ Concert found for seats:', concert.name);
    console.log('📝 Concert venueType:', concert.venueType);

    // Ambil seats berdasarkan concertId
    let seats = [];
    try {
      seats = await Seat.findAll({
        where: { concertId },
        attributes: ['id', 'number', 'row', 'category', 'price', 'status', 'sectionId', 'sectionName'],
        order: [['row', 'ASC'], ['number', 'ASC']]
      });
      console.log('✅ Found seats from database:', seats.length);
    } catch (seatError) {
      console.log('⚠️ Error fetching seats:', seatError.message);
      seats = [];
    }

    // Group by category
    const categories = ['vvip', 'vip', 'regular', 'platinum', 'diamond', 'festival'];
    const seatsByCategory = {};
    
    categories.forEach(cat => {
      seatsByCategory[cat] = seats
        .filter(s => s.category === cat)
        .map(s => ({
          id: s.id,
          number: s.number,
          row: s.row,
          status: s.status || 'available',
          price: s.price || 0,
          sectionName: s.sectionName || cat.toUpperCase()
        }));
    });

    const ticketCategories = await TicketCategory.findAll({
      where: { concertId, status: 'active' },
      order: [['price', 'ASC']]
    });
    const pendingByCategory = new Map();
    for (const ticketCategory of ticketCategories) {
      const pendingCount = await Ticket.count({
        where: { ticketCategoryId: ticketCategory.id, status: 'active' },
        include: [{ model: Order, as: 'order', where: { status: 'pending', expiryDate: { [Op.gt]: new Date() } }, attributes: [] }]
      });
      pendingByCategory.set(ticketCategory.id, pendingCount);
    }

    // Kirim response dengan data lengkap
    res.json({
      success: true,
      data: {
        concert: {
          id: concert.id,
          name: concert.name,
          date: concert.date,
          venueType: concert.venueType || 'hall',
          venueName: concert.venueName || 'Unknown Venue',
          totalTickets: concert.totalTickets || 0
        },
        seats: seatsByCategory,
        ticketCategories: ticketCategories.map((ticketCategory) => ({
          ...ticketCategory.toJSON(),
          available: Math.max(0, Number(ticketCategory.quota) - Number(ticketCategory.sold) - (pendingByCategory.get(ticketCategory.id) || 0))
        })),
        totalAvailable: seats.filter(s => s.status === 'available').length,
        allSeats: seats // Kirim semua seats untuk debugging
      }
    });
  } catch (error) {
    console.error('❌ Get concert seats error:', error);
    console.error('📚 Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch seats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ==================== GET CONCERT BY SLUG ====================
exports.getConcertBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    console.log('🔍 Fetching concert by slug:', slug);
    
    // Cari concert berdasarkan slug (case insensitive)
    const concert = await Concert.findOne({
      where: { 
        slug: slug,
        status: { [Op.in]: ['published', 'on_sale'] }
      },
      include: [
        { model: Venue, as: 'venue' },
        { model: Artist, as: 'artist' },
        { 
          model: User, 
          as: 'organizer',
          attributes: ['id', 'name', 'email']
        },
        { model: Category, as: 'category' },
        { 
          model: Review,
          as: 'concertReviews',
          include: [
            { model: User, as: 'reviewer', attributes: ['id', 'name', 'avatar'] }
          ]
        },
        { model: Ticket, as: 'concertTickets' }
      ]
    });

    if (!concert) {
      console.log('❌ Concert not found with slug:', slug);
      
      // Coba cari dengan ID jika slug berupa number
      if (!isNaN(slug)) {
        const concertById = await Concert.findByPk(parseInt(slug), {
          include: [
            { model: Venue, as: 'venue' },
            { model: Artist, as: 'artist' },
            { 
              model: User, 
              as: 'organizer',
              attributes: ['id', 'name', 'email']
            },
            { model: Category, as: 'category' }
          ]
        });
        if (concertById) {
          return res.json({
            success: true,
            data: concertById
          });
        }
      }
      
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    console.log('✅ Concert found:', concert.name);

    // Increment views
    concert.views = (concert.views || 0) + 1;
    await concert.save();

    // Calculate average rating
    const reviews = concert.concertReviews || [];
    const avgRating = reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0;

    // Get available tickets
    const totalTickets = await Ticket.count({
      where: { concertId: concert.id }
    });
    const soldTickets = await Ticket.count({
      where: { concertId: concert.id, status: 'active' }
    });

    res.json({
      success: true,
      data: {
        ...concert.toJSON(),
        averageRating: avgRating,
        availableTickets: concert.availableTickets || (totalTickets - soldTickets),
        soldTickets: concert.soldTickets || soldTickets,
        totalTickets: concert.totalTickets || totalTickets
      }
    });
  } catch (error) {
    console.error('❌ Get concert by slug error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch concert'
    });
  }
};

// ==================== BOOK A SEAT ====================
exports.bookSeat = async (req, res) => {
  try {
    const { seatId } = req.body;
    const concertId = req.params.id;

    const seat = await Seat.findOne({
      where: { id: seatId, ConcertId: concertId }
    });

    if (!seat) {
      return res.status(404).json({
        success: false,
        message: 'Seat not found'
      });
    }

    if (seat.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Seat is not available'
      });
    }

    // Reserve the seat
    seat.status = 'reserved';
    await seat.save();

    res.json({
      success: true,
      message: 'Seat reserved successfully',
      data: seat
    });
  } catch (error) {
    console.error('❌ Book seat error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== CREATE CONCERT ====================
exports.createConcert = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      rules, 
      date, 
      time, 
      genre, 
      ArtistId, 
      VenueId, 
      CategoryId,
      status,
      isFeatured,
      isFlashSale,
      flashSalePrice,
      flashSaleEnd,
      youtubeTrailer,
      minPrice,
      maxPrice,
      totalTickets,
      availableTickets,
      startSale,
      endSale,
      // Venue fields
      venueType,
      venueName,
      city,
      address,
      seatMapConfig
    } = req.body;

    const slug = slugify(name, { lower: true, strict: true });

    const concert = await Concert.create({
      name,
      slug,
      description,
      rules,
      date,
      time,
      genre,
      ArtistId,
      VenueId,
      CategoryId,
      status: status || 'upcoming',
      isFeatured: isFeatured || false,
      isFlashSale: isFlashSale || false,
      flashSalePrice,
      flashSaleEnd,
      youtubeTrailer,
      minPrice,
      maxPrice,
      totalTickets,
      availableTickets,
      startSale,
      endSale,
      // Venue fields
      venueType: venueType || 'hall',
      venueName: venueName || null,
      city: city || null,
      address: address || null,
      seatMapConfig: seatMapConfig || null
    });

    res.status(201).json({
      success: true,
      data: concert
    });
  } catch (error) {
    console.error('❌ Create concert error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== UPDATE CONCERT ====================
exports.updateConcert = async (req, res) => {
  try {
    const concert = await Concert.findByPk(req.params.id);
    
    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    await concert.update(req.body);

    res.json({
      success: true,
      data: concert
    });
  } catch (error) {
    console.error('❌ Update concert error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== DELETE CONCERT ====================
exports.deleteConcert = async (req, res) => {
  try {
    const concert = await Concert.findByPk(req.params.id);
    
    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    await concert.destroy();

    res.json({
      success: true,
      message: 'Concert deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete concert error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
