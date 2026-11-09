const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  method: {
    type: DataTypes.ENUM('qris', 'bca_va', 'mandiri_va', 'bni_va', 'ovo', 'gopay', 'shopeepay', 'dana', 'credit_card'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'refunded', 'expired'),
    defaultValue: 'pending'
  },
  transactionId: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  paymentUrl: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  paymentData: {
    type: DataTypes.JSON,
    allowNull: true
  },
  responseData: {
    type: DataTypes.JSON,
    allowNull: true
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expiredAt: DataTypes.DATE,
  refundAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  refundReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  refundedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Payment;