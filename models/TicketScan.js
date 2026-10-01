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
    allowNull: true,
    references: { model: 'Users', key: 'id' }
  },
  scanStatus: {
    type: DataTypes.ENUM('accepted', 'duplicate', 'invalid'),
    allowNull: false
  },
  scannedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  deviceId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  scanData: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'TicketScans'
});

module.exports = TicketScan;