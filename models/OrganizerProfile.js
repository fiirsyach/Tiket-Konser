const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrganizerProfile = sequelize.define('OrganizerProfile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  companyName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  companyLogo: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  website: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  instagram: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  youtube: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  verificationStatus: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  verificationNotes: DataTypes.TEXT,
  verifiedAt: DataTypes.DATE,
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
  identityDocument: {
    type: DataTypes.STRING,
    allowNull: true
  },
  companyDocument: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = OrganizerProfile;