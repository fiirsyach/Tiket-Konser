const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TicketCategory = sequelize.define('TicketCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  organizerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  concertId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Concerts', key: 'id' },
    onDelete: 'CASCADE'
  },
  category: {
    type: DataTypes.ENUM('Festival', 'Regular', 'VIP', 'VVIP', 'Platinum', 'Diamond'),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  quota: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  sold: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active'
  }
}, {
  timestamps: true,
  tableName: 'TicketCategories',
  indexes: [{ unique: true, fields: ['concertId', 'category'] }]
});

module.exports = TicketCategory;