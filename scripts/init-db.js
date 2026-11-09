const { User, SystemSetting } = require('../models');

const initDatabase = async () => {
  try {
    const defaults = [
      ['site_name', 'ShowTime', 'string', 'general', 'Site name'],
      ['site_description', 'Platform ticketing konser terpercaya', 'string', 'general', 'Site description'],
      ['currency', 'IDR', 'string', 'general', 'Default currency'],
      ['service_fee_percent', '5', 'number', 'payment', 'Service fee percentage'],
      ['min_withdrawal', '100000', 'number', 'payment', 'Minimum withdrawal'],
      ['withdrawal_fee', '5000', 'number', 'payment', 'Withdrawal fee'],
      ['maintenance_mode', 'false', 'boolean', 'system', 'Maintenance mode']
    ];
    for (const [key, value, type, category, description] of defaults) {
      await SystemSetting.findOrCreate({
        where: { key },
        defaults: { value, type, category, description }
      });
    }

    const existingSuperAdmin = await User.findOne({
      where: { email: 'super@gmail.com', role: 'super_admin' }
    });

    if (existingSuperAdmin) {
      console.log('✅ Super admin account already exists.');
      return;
    }

    console.log('📝 Creating the required super admin account...');
    await User.create({
      name: 'Super Admin',
      email: 'super@gmail.com',
      password: '$2a$12$JynsjN32uB2l9lh8ZJylBuoWrBQpsAqDc2TJ8.I68fXsZFLIDs4tG',
      role: 'super_admin',
      status: 'active',
      isVerified: true
    }, { hooks: false });
    console.log('✅ Super Admin created');
    
  } catch (error) {
    console.error('❌ Error init database:', error);
    throw error;
  }
};

module.exports = initDatabase;