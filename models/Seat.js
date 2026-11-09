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
    allowNull: true
  },
  number: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  category: {
    type: DataTypes.ENUM('festival', 'regular', 'vip', 'vvip', 'platinum', 'diamond'),
    defaultValue: 'regular'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
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
    onDelete: 'SET NULL'
  },
  seatNumber: DataTypes.STRING(20),
  reservedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
    onDelete: 'SET NULL'
  },
  reservedUntil: DataTypes.DATE
}, {
  timestamps: true,
  indexes: [{ unique: true, fields: ['concertId', 'row', 'number'], name: 'unique_seat' }]
});

module.exports = Seat;