const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const slugify = require('slugify');

const Concert = sequelize.define('Concert', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  organizerId: {
    type: DataTypes.INTEGER,
    allowNull: false
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
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  artistId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  },
  rules: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  thumbnail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  banner: {
    type: DataTypes.STRING,
    allowNull: true
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  time: {
    type: DataTypes.TIME,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  genre: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected', 'published', 'on_sale', 'sold_out', 'finished', 'cancelled'),
    defaultValue: 'draft'
  },
  isFeatured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isFlashSale: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  flashSalePrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  flashSaleEnd: {
    type: DataTypes.DATE,
    allowNull: true
  },
  youtubeTrailer: {
    type: DataTypes.STRING,
    allowNull: true
  },
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  minPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  maxPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  totalTickets: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  soldTickets: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  availableTickets: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  startSale: {
    type: DataTypes.DATE,
    allowNull: true
  },
  endSale: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // ==================== VENUE FIELDS ====================
  venueType: {
    type: DataTypes.ENUM('stadium', 'hall', 'outdoor', 'arena'),
    allowNull: true,
    defaultValue: 'hall'
  },
  venueName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  venueId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  // Seat Map Configuration
  seatMapConfig: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      sections: [],
      stagePosition: 'front',
      totalSeats: 0
    }
  }
}, {
  timestamps: true,
  hooks: {
    beforeCreate: (concert) => {
      if (!concert.slug) {
        concert.slug = slugify(concert.name, { lower: true, strict: true });
      }
      if (!concert.artistId) {
        concert.artistId = null;
      }
      if (!concert.venueType) {
        concert.venueType = 'hall';
      }
    },
    beforeUpdate: (concert) => {
      if (concert.changed('name') && !concert.changed('slug')) {
        concert.slug = slugify(concert.name, { lower: true, strict: true });
      }
      if (!concert.artistId) {
        concert.artistId = null;
      }
    }
  }
});

module.exports = Concert;
