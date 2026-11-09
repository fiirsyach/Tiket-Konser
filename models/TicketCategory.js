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
    references: { model: 'Users', key: 'id' },
    onDelete: 'CASCADE'
  },
  concertId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Concerts', key: 'id' },
    onDelete: 'CASCADE'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  quota: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  sold: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  available: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  maxPerUser: {
    type: DataTypes.INTEGER,
    defaultValue: 10
  },
  benefits: DataTypes.JSON,
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'sold_out'),
    allowNull: false,
    defaultValue: 'active'
  }
}, {
  timestamps: true,
  tableName: 'TicketCategories',
  indexes: []
});

module.exports = TicketCategory;