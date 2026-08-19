const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Seat = sequelize.define('Seat', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sectionId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sectionName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  row: {
    type: DataTypes.STRING,
    allowNull: false
  },
  number: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM('vvip', 'vip', 'regular', 'platinum', 'diamond'),
    defaultValue: 'regular'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('available', 'selected', 'booked', 'reserved', 'disabled'),
    defaultValue: 'available'
  },
  // Position untuk seat map
  x: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  y: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  rotation: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  isAccessible: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isRestricted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  concertId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Concerts',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  venueId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Venues',
      key: 'id'
    },
    onDelete: 'CASCADE'
  }
}, {
  timestamps: true
});

module.exports = Seat;