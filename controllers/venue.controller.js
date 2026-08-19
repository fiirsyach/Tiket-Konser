// controllers/venue.controller.js
const { Venue, Concert, Seat } = require('../models');
const { Op } = require('sequelize');
const slugify = require('slugify');

// ==================== GET ALL VENUES ====================
exports.getVenues = async (req, res) => {
  try {
    const { page = 1, limit = 20, city, search, type } = req.query;
    const offset = (page - 1) * limit;
    const where = { status: 'active' };

    if (city) where.city = { [Op.like]: `%${city}%` };
    if (type) where.type = type;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } }
      ];
    }

    const venues = await Venue.findAndCountAll({
      where,
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: venues.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: venues.count,
        totalPages: Math.ceil(venues.count / limit)
      }
    });
  } catch (error) {
    console.error('❌ Get venues error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== GET SINGLE VENUE ====================
exports.getVenue = async (req, res) => {
  try {
    const venue = await Venue.findByPk(req.params.id, {
      include: [
        { 
          model: Concert,
          as: 'concerts',
          attributes: ['id', 'name', 'date', 'status']
        }
      ]
    });

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found'
      });
    }

    res.json({
      success: true,
      data: venue
    });
  } catch (error) {
    console.error('❌ Get venue error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== GET VENUE TYPES ====================
exports.getVenueTypes = async (req, res) => {
  try {
    const venueTypes = [
      {
        id: 'stadium',
        name: 'Stadium',
        icon: '🏟️',
        description: 'Melingkar/oval seperti stadion, tribun mengelilingi area panggung',
        features: ['Tribun melingkar', 'Stage di salah satu sisi', 'Kapasitas besar'],
        preview: 'stadium'
      },
      {
        id: 'hall',
        name: 'Concert Hall',
        icon: '🏛️',
        description: 'Persegi/persegi panjang seperti gedung konser indoor',
        features: ['Layout teratur', 'Stage di depan', 'Akustik terbaik'],
        preview: 'hall'
      },
      {
        id: 'outdoor',
        name: 'Outdoor',
        icon: '🌳',
        description: 'Area terbuka untuk festival dengan standing dan seating area',
        features: ['Area terbuka', 'Standing & Seating', 'Fleksibel'],
        preview: 'outdoor'
      },
      {
        id: 'arena',
        name: 'Arena',
        icon: '🎪',
        description: 'Oval/bulat seperti arena indoor dengan seating mengelilingi stage',
        features: ['Seating mengelilingi', 'Stage tengah/samping', 'Intim'],
        preview: 'arena'
      }
    ];

    res.json({
      success: true,
      data: venueTypes
    });
  } catch (error) {
    console.error('❌ Get venue types error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== GENERATE SEAT LAYOUT ====================
exports.generateSeatLayout = async (req, res) => {
  try {
    const { type, capacity, stagePosition, sections } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Venue type is required'
      });
    }

    const layout = generateLayoutByType(type, capacity || 1000, stagePosition || 'front', sections);

    res.json({
      success: true,
      data: layout
    });
  } catch (error) {
    console.error('❌ Generate seat layout error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== GET VENUE SEATS ====================
exports.getVenueSeats = async (req, res) => {
  try {
    const venue = await Venue.findByPk(req.params.id);
    
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found'
      });
    }

    const concerts = await Concert.findAll({
      where: { venueId: venue.id },
      attributes: ['id']
    });

    const concertIds = concerts.map(c => c.id);

    const seats = await Seat.findAll({
      where: { 
        venueId: venue.id,
        concertId: { [Op.in]: concertIds }
      },
      attributes: ['id', 'row', 'number', 'category', 'price', 'status', 'sectionId', 'sectionName']
    });

    res.json({
      success: true,
      data: {
        venue,
        seats: seats || []
      }
    });
  } catch (error) {
    console.error('❌ Get venue seats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== CREATE VENUE ====================
exports.createVenue = async (req, res) => {
  try {
    const { 
      name, 
      type, 
      stageType,
      city, 
      address, 
      latitude, 
      longitude, 
      capacity, 
      description, 
      facilities 
    } = req.body;

    if (!name) {
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

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Venue type is required (stadium, hall, outdoor, arena)'
      });
    }

    const slug = slugify(name, { lower: true, strict: true });

    const seatConfig = generateVenueSeatConfig(type, stageType || 'front', capacity || 1000);

    const venue = await Venue.create({
      name,
      slug,
      type,
      stageType: stageType || 'front',
      city,
      address,
      latitude: latitude || null,
      longitude: longitude || null,
      capacity: capacity || 0,
      description,
      facilities: facilities || null,
      seatConfig,
      status: 'active',
      organizerId: req.user?.id || null
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
      message: error.message
    });
  }
};

// ==================== UPDATE VENUE ====================
exports.updateVenue = async (req, res) => {
  try {
    const venue = await Venue.findByPk(req.params.id);
    
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found'
      });
    }

    const updateData = req.body;
    if (updateData.name) {
      updateData.slug = slugify(updateData.name, { lower: true, strict: true });
    }

    if (updateData.type && updateData.type !== venue.type) {
      updateData.seatConfig = generateVenueSeatConfig(
        updateData.type, 
        updateData.stageType || venue.stageType,
        updateData.capacity || venue.capacity
      );
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
      message: error.message
    });
  }
};

// ==================== DELETE VENUE ====================
exports.deleteVenue = async (req, res) => {
  try {
    const venue = await Venue.findByPk(req.params.id);
    
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found'
      });
    }

    const upcomingConcerts = await Concert.count({
      where: {
        venueId: venue.id,
        date: { [Op.gt]: new Date() },
        status: { [Op.in]: ['upcoming', 'published', 'on_sale'] }
      }
    });

    if (upcomingConcerts > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete venue with ${upcomingConcerts} upcoming concerts`
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
      message: error.message
    });
  }
};

// ==================== HELPER: Generate Venue Seat Config ====================
function generateVenueSeatConfig(type, stageType, capacity) {
  switch (type) {
    case 'stadium':
      return generateStadiumConfig(capacity);
    case 'hall':
      return generateHallConfig(capacity);
    case 'outdoor':
      return generateOutdoorConfig(capacity);
    case 'arena':
      return generateArenaConfig(capacity);
    default:
      return generateHallConfig(capacity);
  }
}

// ==================== STADIUM CONFIG ====================
function generateStadiumConfig(capacity) {
  const numSections = 8;
  const seatsPerSection = Math.floor(capacity / numSections);
  const rowsPerSection = 20;
  const categories = ['vvip', 'vip', 'regular', 'regular', 'regular', 'regular', 'vip', 'vvip'];

  const sections = [];
  for (let i = 0; i < numSections; i++) {
    const angle = (i / numSections) * 2 * Math.PI;
    const category = categories[i % categories.length];
    sections.push({
      id: `section-${i + 1}`,
      name: `Section ${String.fromCharCode(65 + i)}`,
      angle: angle,
      rows: rowsPerSection,
      seatsPerRow: Math.floor(seatsPerSection / rowsPerSection),
      category: category,
      price: getPriceByCategory(category)
    });
  }

  return {
    sections,
    stage: { x: 0.5, y: 0.15, width: 0.3, height: 0.1 },
    aisles: [
      { x: 0.25, y: 0.2, width: 0.02, height: 0.7 },
      { x: 0.75, y: 0.2, width: 0.02, height: 0.7 }
    ],
    entrance: { x: 0.5, y: 0.92 },
    totalSeats: capacity,
    type: 'stadium'
  };
}

// ==================== HALL CONFIG ====================
function generateHallConfig(capacity) {
  const rows = Math.floor(Math.sqrt(capacity / 2));
  const seatsPerRow = Math.floor(capacity / rows);

  const sections = [
    {
      id: 'vvip',
      name: 'VVIP',
      rows: 3,
      seatsPerRow: Math.floor(seatsPerRow * 0.6),
      category: 'vvip',
      price: getPriceByCategory('vvip'),
      x: 0.2,
      y: 0.2
    },
    {
      id: 'vip',
      name: 'VIP',
      rows: 5,
      seatsPerRow: Math.floor(seatsPerRow * 0.8),
      category: 'vip',
      price: getPriceByCategory('vip'),
      x: 0.1,
      y: 0.35
    },
    {
      id: 'regular',
      name: 'Regular',
      rows: rows - 8,
      seatsPerRow: seatsPerRow,
      category: 'regular',
      price: getPriceByCategory('regular'),
      x: 0,
      y: 0.5
    }
  ];

  return {
    sections,
    stage: { x: 0.5, y: 0.08, width: 0.4, height: 0.08 },
    aisles: [
      { x: 0.3, y: 0.15, width: 0.02, height: 0.75 },
      { x: 0.7, y: 0.15, width: 0.02, height: 0.75 }
    ],
    entrance: { x: 0.5, y: 0.92 },
    totalSeats: capacity,
    type: 'hall'
  };
}

// ==================== OUTDOOR CONFIG ====================
function generateOutdoorConfig(capacity) {
  const rows = Math.floor(Math.sqrt(capacity / 3));
  const seatsPerRow = Math.floor(capacity / rows);

  const sections = [
    {
      id: 'vip-standing',
      name: 'VIP Standing',
      category: 'vip',
      type: 'standing',
      capacity: Math.floor(capacity * 0.15),
      price: getPriceByCategory('vip')
    },
    {
      id: 'vvip',
      name: 'VVIP Seating',
      rows: 3,
      seatsPerRow: Math.floor(seatsPerRow * 0.7),
      category: 'vvip',
      price: getPriceByCategory('vvip'),
      x: 0.15,
      y: 0.15
    },
    {
      id: 'vip-seating',
      name: 'VIP Seating',
      rows: 5,
      seatsPerRow: Math.floor(seatsPerRow * 0.85),
      category: 'vip',
      price: getPriceByCategory('vip'),
      x: 0.07,
      y: 0.3
    },
    {
      id: 'regular-standing',
      name: 'Regular Standing',
      category: 'regular',
      type: 'standing',
      capacity: Math.floor(capacity * 0.3),
      price: getPriceByCategory('regular')
    },
    {
      id: 'regular-seating',
      name: 'Regular Seating',
      rows: rows - 8,
      seatsPerRow: seatsPerRow,
      category: 'regular',
      price: getPriceByCategory('regular'),
      x: 0,
      y: 0.45
    }
  ];

  return {
    sections,
    stage: { x: 0.5, y: 0.05, width: 0.5, height: 0.08 },
    aisles: [
      { x: 0.33, y: 0.12, width: 0.02, height: 0.8 },
      { x: 0.67, y: 0.12, width: 0.02, height: 0.8 }
    ],
    entrance: { x: 0.5, y: 0.92 },
    totalSeats: capacity,
    type: 'outdoor',
    isOutdoor: true
  };
}

// ==================== ARENA CONFIG ====================
function generateArenaConfig(capacity) {
  const numSections = 6;
  const seatsPerSection = Math.floor(capacity / numSections);
  const categories = ['vvip', 'vvip', 'vip', 'vip', 'regular', 'regular'];

  const sections = [];
  for (let i = 0; i < numSections; i++) {
    const angle = (i / numSections) * 2 * Math.PI + Math.PI / 2;
    const category = categories[i % categories.length];
    sections.push({
      id: `arena-${i + 1}`,
      name: `Arena ${String.fromCharCode(65 + i)}`,
      angle: angle,
      rows: 15,
      seatsPerRow: Math.floor(seatsPerSection / 15),
      category: category,
      price: getPriceByCategory(category)
    });
  }

  return {
    sections,
    stage: { x: 0.5, y: 0.3, width: 0.2, height: 0.2 },
    aisles: [
      { x: 0.2, y: 0.2, width: 0.02, height: 0.6 },
      { x: 0.8, y: 0.2, width: 0.02, height: 0.6 }
    ],
    entrance: { x: 0.5, y: 0.92 },
    totalSeats: capacity,
    type: 'arena',
    isArena: true
  };
}

// ==================== HELPER: Get Price by Category ====================
function getPriceByCategory(category) {
  const prices = {
    diamond: 1000000,
    platinum: 750000,
    vvip: 500000,
    vip: 350000,
    regular: 150000,
    festival: 200000
  };
  return prices[category] || 150000;
}

// ==================== GENERATE LAYOUT BY TYPE ====================
function generateLayoutByType(type, capacity, stagePosition, customSections) {
  switch (type) {
    case 'stadium':
      return generateStadiumLayout(capacity, stagePosition, customSections);
    case 'hall':
      return generateHallLayout(capacity, stagePosition, customSections);
    case 'outdoor':
      return generateOutdoorLayout(capacity, stagePosition, customSections);
    case 'arena':
      return generateArenaLayout(capacity, stagePosition, customSections);
    default:
      return generateHallLayout(capacity, stagePosition, customSections);
  }
}

// ==================== STADIUM LAYOUT ====================
function generateStadiumLayout(capacity, stagePosition, customSections) {
  const sections = customSections && customSections.length > 0 ? customSections : [
    { id: 'vvip', name: 'VVIP', category: 'vvip', rows: 3, seatsPerRow: 8, price: 750000 },
    { id: 'vip-a', name: 'VIP A', category: 'vip', rows: 5, seatsPerRow: 10, price: 500000 },
    { id: 'vip-b', name: 'VIP B', category: 'vip', rows: 5, seatsPerRow: 10, price: 500000 },
    { id: 'regular-a', name: 'Regular A', category: 'regular', rows: 10, seatsPerRow: 15, price: 200000 },
    { id: 'regular-b', name: 'Regular B', category: 'regular', rows: 10, seatsPerRow: 15, price: 200000 },
    { id: 'upper', name: 'Upper Tribune', category: 'regular', rows: 8, seatsPerRow: 20, price: 150000 }
  ];

  let totalSeats = 0;
  sections.forEach(s => {
    totalSeats += (s.rows || 0) * (s.seatsPerRow || 0);
  });

  return {
    type: 'stadium',
    stagePosition: stagePosition || 'front',
    totalSeats: totalSeats,
    sections: sections.map((s, index) => ({
      ...s,
      angle: (index / sections.length) * 2 * Math.PI,
      rows: s.rows || 5,
      seatsPerRow: s.seatsPerRow || 10
    })),
    stage: { x: 0.5, y: 0.15, width: 0.3, height: 0.1 },
    aisles: [
      { x: 0.25, y: 0.2, width: 0.02, height: 0.7 },
      { x: 0.75, y: 0.2, width: 0.02, height: 0.7 }
    ],
    entrance: { x: 0.5, y: 0.92 }
  };
}

// ==================== HALL LAYOUT ====================
function generateHallLayout(capacity, stagePosition, customSections) {
  const sections = customSections && customSections.length > 0 ? customSections : [
    { id: 'vvip', name: 'VVIP', category: 'vvip', rows: 4, seatsPerRow: 8, price: 750000 },
    { id: 'vip', name: 'VIP', category: 'vip', rows: 6, seatsPerRow: 12, price: 450000 },
    { id: 'regular', name: 'Regular', category: 'regular', rows: 15, seatsPerRow: 16, price: 200000 }
  ];

  let totalSeats = 0;
  sections.forEach(s => {
    totalSeats += (s.rows || 0) * (s.seatsPerRow || 0);
  });

  return {
    type: 'hall',
    stagePosition: stagePosition || 'front',
    totalSeats: totalSeats,
    sections: sections.map(s => ({
      ...s,
      rows: s.rows || 10,
      seatsPerRow: s.seatsPerRow || 10
    })),
    stage: { x: 0.5, y: 0.08, width: 0.4, height: 0.08 },
    aisles: [
      { x: 0.33, y: 0.15, width: 0.02, height: 0.75 },
      { x: 0.67, y: 0.15, width: 0.02, height: 0.75 }
    ],
    entrance: { x: 0.5, y: 0.92 }
  };
}

// ==================== OUTDOOR LAYOUT ====================
function generateOutdoorLayout(capacity, stagePosition, customSections) {
  const sections = customSections && customSections.length > 0 ? customSections : [
    { id: 'vip-standing', name: 'VIP Standing', category: 'vip', type: 'standing', capacity: 200, price: 350000 },
    { id: 'vip-seating', name: 'VIP Seating', category: 'vip', rows: 5, seatsPerRow: 10, price: 400000 },
    { id: 'regular-standing', name: 'Regular Standing', category: 'regular', type: 'standing', capacity: 500, price: 150000 },
    { id: 'regular-seating', name: 'Regular Seating', category: 'regular', rows: 10, seatsPerRow: 15, price: 200000 }
  ];

  let totalSeats = 0;
  sections.forEach(s => {
    if (s.type === 'standing') {
      totalSeats += s.capacity || 0;
    } else {
      totalSeats += (s.rows || 0) * (s.seatsPerRow || 0);
    }
  });

  return {
    type: 'outdoor',
    stagePosition: stagePosition || 'front',
    totalSeats: totalSeats,
    sections: sections.map(s => ({
      ...s,
      rows: s.rows || 5,
      seatsPerRow: s.seatsPerRow || 10
    })),
    stage: { x: 0.5, y: 0.05, width: 0.5, height: 0.08 },
    aisles: [
      { x: 0.33, y: 0.12, width: 0.02, height: 0.8 },
      { x: 0.67, y: 0.12, width: 0.02, height: 0.8 }
    ],
    entrance: { x: 0.5, y: 0.92 }
  };
}

// ==================== ARENA LAYOUT ====================
function generateArenaLayout(capacity, stagePosition, customSections) {
  const isCenterStage = stagePosition === 'center';
  
  const sections = customSections && customSections.length > 0 ? customSections : [
    { id: 'vvip', name: 'VVIP', category: 'vvip', rows: 3, seatsPerRow: 8, price: 800000 },
    { id: 'vip-front', name: 'VIP Front', category: 'vip', rows: 4, seatsPerRow: 12, price: 500000 },
    { id: 'vip-back', name: 'VIP Back', category: 'vip', rows: 4, seatsPerRow: 12, price: 450000 },
    { id: 'regular-a', name: 'Regular A', category: 'regular', rows: 6, seatsPerRow: 15, price: 250000 },
    { id: 'regular-b', name: 'Regular B', category: 'regular', rows: 6, seatsPerRow: 15, price: 200000 }
  ];

  let totalSeats = 0;
  sections.forEach(s => {
    totalSeats += (s.rows || 0) * (s.seatsPerRow || 0);
  });

  return {
    type: 'arena',
    stagePosition: stagePosition || 'front',
    totalSeats: totalSeats,
    sections: sections.map((s, index) => ({
      ...s,
      angle: isCenterStage ? (index / sections.length) * 2 * Math.PI : 0,
      rows: s.rows || 5,
      seatsPerRow: s.seatsPerRow || 10
    })),
    stage: isCenterStage 
      ? { x: 0.5, y: 0.4, width: 0.2, height: 0.2 }
      : { x: 0.5, y: 0.15, width: 0.3, height: 0.15 },
    aisles: [
      { x: 0.25, y: 0.2, width: 0.02, height: 0.6 },
      { x: 0.75, y: 0.2, width: 0.02, height: 0.6 }
    ],
    entrance: { x: 0.5, y: 0.92 }
  };
}

// ==================== SEAT LAYOUT GENERATOR ====================
function generateSeatLayout(venue) {
  const config = venue.seatConfig || {};
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
          id: `seat-${sectionIndex}-${r}-${s}`,
          sectionId: section.id,
          sectionName: section.name,
          row: rowLetter,
          number: s + 1,
          category: category,
          price: price,
          status: 'available'
        });
      }
    }
  });

  return {
    venue: {
      id: venue.id,
      name: venue.name,
      type: venue.type,
      stageType: venue.stageType
    },
    config: config,
    seats: seats,
    totalSeats: seats.length
  };
}