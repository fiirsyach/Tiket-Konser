const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TicketScan = sequelize.define('TicketScan', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ticketId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Tickets', key: 'id' }
  },
  scannedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  isValid: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  scannedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  location: DataTypes.STRING,
  notes: DataTypes.TEXT
}, {
  timestamps: false,
  tableName: 'TicketScans'
});

module.exports = TicketScan;