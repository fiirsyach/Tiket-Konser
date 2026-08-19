const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ticket = sequelize.define('Ticket', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  organizerId: {
    type: DataTypes.INTEGER,
    allowNull: true, // <-- Ubah menjadi true
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  concertId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Concerts',
      key: 'id'
    }
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Orders',
      key: 'id'
    }
  },
  seatId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Seats',
      key: 'id'
    }
  },
  ticketNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  category: {
    type: DataTypes.ENUM('Festival', 'Regular', 'VIP', 'VVIP', 'Platinum', 'Diamond'),
    allowNull: false,
    defaultValue: 'Regular'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  quota: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  sold: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  available: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('active', 'used', 'refunded', 'cancelled'),
    defaultValue: 'active'
  },
  qrCode: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Ticket;