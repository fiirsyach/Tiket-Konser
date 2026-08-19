const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const slugify = require('slugify');

const Venue = sequelize.define('Venue', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  type: {
    type: DataTypes.ENUM('stadium', 'hall', 'outdoor', 'arena'),
    allowNull: false,
    defaultValue: 'hall'
  },
  stageType: {
    type: DataTypes.ENUM('front', 'center', 'end', 'thrust', 'in_the_round'),
    defaultValue: 'front'
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  image: {
    type: DataTypes.STRING,
    allowNull: true
  },
  seatConfig: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },
  facilities: {
    type: DataTypes.JSON,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'maintenance'),
    defaultValue: 'active'
  },
  organizerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  hooks: {
    beforeCreate: (venue) => {
      if (!venue.slug) {
        venue.slug = slugify(venue.name, { lower: true, strict: true });
      }
    },
    beforeUpdate: (venue) => {
      if (venue.changed('name') && !venue.changed('slug')) {
        venue.slug = slugify(venue.name, { lower: true, strict: true });
      }
    }
  }
});

// Function to generate seat configuration based on venue type
function generateSeatConfig(type, stageType, capacity) {
  const config = {
    sections: [],
    stage: { x: 0.5, y: 0.1, width: 0.4, height: 0.1 },
    aisles: [],
    entrance: { x: 0.5, y: 0.9 },
    rows: 0,
    columns: 0,
    totalSeats: 0
  };

  switch (type) {
    case 'stadium':
      return generateStadiumConfig(capacity);
    case 'concert_hall':
      return generateConcertHallConfig(capacity);
    case 'outdoor':
      return generateOutdoorConfig(capacity);
    case 'arena':
      return generateArenaConfig(capacity);
    case 'theater':
      return generateTheaterConfig(capacity);
    case 'club':
      return generateClubConfig(capacity);
    default:
      return generateConcertHallConfig(capacity);
  }
}

function generateStadiumConfig(capacity) {
  // Stadium config - melingkar/oval
  const sections = [];
  const numSections = 8;
  const seatsPerSection = Math.floor(capacity / numSections);
  const rowsPerSection = 20;

  for (let i = 0; i < numSections; i++) {
    const angle = (i / numSections) * 2 * Math.PI;
    const section = {
      id: `section-${i + 1}`,
      name: `Section ${String.fromCharCode(65 + i)}`,
      angle: angle,
      rows: rowsPerSection,
      seatsPerRow: Math.floor(seatsPerSection / rowsPerSection),
      category: getCategoryByAngle(angle),
      seats: []
    };
    sections.push(section);
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
    isStadium: true
  };
}

function generateConcertHallConfig(capacity) {
  // Concert Hall - teratur menghadap panggung
  const sections = [];
  const rows = Math.floor(Math.sqrt(capacity / 2));
  const seatsPerRow = Math.floor(capacity / rows);

  // VVIP di depan
  sections.push({
    id: 'vvip',
    name: 'VVIP',
    rows: 3,
    seatsPerRow: Math.floor(seatsPerRow * 0.6),
    category: 'vvip',
    x: 0.2,
    y: 0.2
  });

  // VIP di tengah
  sections.push({
    id: 'vip',
    name: 'VIP',
    rows: 5,
    seatsPerRow: Math.floor(seatsPerRow * 0.8),
    category: 'vip',
    x: 0.1,
    y: 0.35
  });

  // Regular di belakang
  sections.push({
    id: 'regular',
    name: 'Regular',
    rows: rows - 8,
    seatsPerRow: seatsPerRow,
    category: 'regular',
    x: 0,
    y: 0.5
  });

  return {
    sections,
    stage: { x: 0.5, y: 0.08, width: 0.4, height: 0.08 },
    aisles: [
      { x: 0.3, y: 0.15, width: 0.02, height: 0.75 },
      { x: 0.7, y: 0.15, width: 0.02, height: 0.75 }
    ],
    entrance: { x: 0.5, y: 0.92 },
    totalSeats: capacity
  };
}

function generateOutdoorConfig(capacity) {
  // Outdoor - blok horizontal
  const sections = [];
  const rows = Math.floor(Math.sqrt(capacity / 3));
  const seatsPerRow = Math.floor(capacity / rows);

  sections.push({
    id: 'vvip',
    name: 'VVIP',
    rows: 3,
    seatsPerRow: Math.floor(seatsPerRow * 0.7),
    category: 'vvip',
    x: 0.15,
    y: 0.15
  });

  sections.push({
    id: 'vip',
    name: 'VIP',
    rows: 5,
    seatsPerRow: Math.floor(seatsPerRow * 0.85),
    category: 'vip',
    x: 0.07,
    y: 0.3
  });

  sections.push({
    id: 'regular',
    name: 'Regular',
    rows: rows - 8,
    seatsPerRow: seatsPerRow,
    category: 'regular',
    x: 0,
    y: 0.45
  });

  return {
    sections,
    stage: { x: 0.5, y: 0.05, width: 0.5, height: 0.08 },
    aisles: [
      { x: 0.33, y: 0.12, width: 0.02, height: 0.8 },
      { x: 0.67, y: 0.12, width: 0.02, height: 0.8 }
    ],
    entrance: { x: 0.5, y: 0.92 },
    totalSeats: capacity,
    isOutdoor: true
  };
}

function generateArenaConfig(capacity) {
  // Arena - oval dengan tribun mengelilingi
  const sections = [];
  const numSections = 6;
  const seatsPerSection = Math.floor(capacity / numSections);

  for (let i = 0; i < numSections; i++) {
    const angle = (i / numSections) * 2 * Math.PI + Math.PI / 2;
    const category = i < 2 ? 'vvip' : i < 4 ? 'vip' : 'regular';
    sections.push({
      id: `arena-${i + 1}`,
      name: `Arena ${String.fromCharCode(65 + i)}`,
      angle: angle,
      rows: 15,
      seatsPerRow: Math.floor(seatsPerSection / 15),
      category: category,
      seats: []
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
    isArena: true
  };
}

function generateTheaterConfig(capacity) {
  // Theater - layout theater klasik
  const sections = [];
  const rows = Math.floor(capacity / 12);
  const seatsPerRow = 12;

  // Orchestra
  sections.push({
    id: 'orchestra',
    name: 'Orchestra',
    rows: Math.floor(rows * 0.3),
    seatsPerRow: seatsPerRow,
    category: 'vvip',
    x: 0.1,
    y: 0.2
  });

  // Mezzanine
  sections.push({
    id: 'mezzanine',
    name: 'Mezzanine',
    rows: Math.floor(rows * 0.3),
    seatsPerRow: seatsPerRow - 2,
    category: 'vip',
    x: 0.15,
    y: 0.45
  });

  // Balcony
  sections.push({
    id: 'balcony',
    name: 'Balcony',
    rows: rows - Math.floor(rows * 0.6),
    seatsPerRow: seatsPerRow - 4,
    category: 'regular',
    x: 0.2,
    y: 0.65
  });

  return {
    sections,
    stage: { x: 0.5, y: 0.08, width: 0.4, height: 0.08 },
    aisles: [
      { x: 0.35, y: 0.15, width: 0.02, height: 0.75 },
      { x: 0.65, y: 0.15, width: 0.02, height: 0.75 }
    ],
    entrance: { x: 0.5, y: 0.92 },
    totalSeats: capacity
  };
}

function generateClubConfig(capacity) {
  // Club - layout club/intimate
  const sections = [];
  const rows = Math.floor(capacity / 10);
  const seatsPerRow = 10;

  sections.push({
    id: 'vip',
    name: 'VIP',
    rows: 3,
    seatsPerRow: seatsPerRow,
    category: 'vip',
    x: 0.05,
    y: 0.2
  });

  sections.push({
    id: 'regular',
    name: 'Regular',
    rows: rows - 3,
    seatsPerRow: seatsPerRow,
    category: 'regular',
    x: 0.05,
    y: 0.4
  });

  return {
    sections,
    stage: { x: 0.5, y: 0.05, width: 0.6, height: 0.12 },
    aisles: [{ x: 0.5, y: 0.15, width: 0.02, height: 0.75 }],
    entrance: { x: 0.5, y: 0.92 },
    totalSeats: capacity
  };
}

function getCategoryByAngle(angle) {
  // VVIP jika dekat stage (angle sekitar 0 atau 2π)
  if (angle < 0.5 || angle > 2 * Math.PI - 0.5) return 'vvip';
  if (angle < 1 || angle > 2 * Math.PI - 1) return 'vip';
  return 'regular';
}

module.exports = Venue;