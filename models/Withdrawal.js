const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Withdrawal = sequelize.define('Withdrawal', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  withdrawalNumber: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  organizerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  fee: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  netAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  bankName: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  bankAccount: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  bankHolder: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'rejected', 'cancelled'),
    defaultValue: 'pending'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  processedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  transferProof: DataTypes.STRING,
  transferReference: DataTypes.STRING
}, {
  timestamps: true
});

module.exports = Withdrawal;