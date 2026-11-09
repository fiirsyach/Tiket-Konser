const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcrypt');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  avatar: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  role: {
    type: DataTypes.ENUM('customer', 'organizer', 'admin', 'super_admin'),
    allowNull: false,
    defaultValue: 'customer'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'blocked'),
    defaultValue: 'active'
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  dateOfBirth: DataTypes.DATEONLY,
  gender: DataTypes.ENUM('male', 'female', 'other'),
  bio: DataTypes.TEXT,
  country: DataTypes.STRING(100),
  city: DataTypes.STRING(100),
  address: DataTypes.TEXT,
  language: {
    type: DataTypes.STRING(10),
    defaultValue: 'id'
  },
  timezone: {
    type: DataTypes.STRING(50),
    defaultValue: 'Asia/Jakarta'
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'IDR'
  },
  emailNotification: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  pushNotification: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  twoFactorEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  refreshToken: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  },
  resetPasswordToken: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  resetPasswordExpire: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

User.prototype.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = User;