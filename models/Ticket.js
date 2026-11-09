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
    allowNull: false,
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
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  ticketCategoryId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'TicketCategories',
      key: 'id'
    }
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
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
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  category: {
    type: DataTypes.ENUM('festival', 'regular', 'vip', 'vvip', 'platinum', 'diamond'),
    defaultValue: 'regular'
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  section: DataTypes.STRING(100),
  row: DataTypes.STRING(10),
  seatNumber: DataTypes.STRING(20),
  qrData: DataTypes.JSON,
  scannedAt: DataTypes.DATE,
  scannedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
    onDelete: 'SET NULL'
  },
  pdfUrl: DataTypes.STRING,
  pdfGeneratedAt: DataTypes.DATE,
  validUntil: DataTypes.DATE,
  status: {
    type: DataTypes.ENUM('active', 'used', 'expired', 'refunded', 'cancelled'),
    defaultValue: 'active'
  },
  qrCode: DataTypes.TEXT
}, {
  timestamps: true
});

module.exports = Ticket;