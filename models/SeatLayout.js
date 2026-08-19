const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SeatLayout = sequelize.define('SeatLayout', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  rows: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  columns: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  sections: {
    type: DataTypes.JSON,
    allowNull: true
  },
  configuration: {
    type: DataTypes.JSON,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  }
}, {
  timestamps: true
});

module.exports = SeatLayout;