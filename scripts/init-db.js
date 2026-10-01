const { User, OrganizerProfile, Venue, Artist, Category } = require('../models');

const initDatabase = async () => {
  try {
    const existingSuperAdmin = await User.findOne({
      where: { email: 'super@gmail.com', role: 'super_admin' }
    });

    if (existingSuperAdmin) {
      console.log('✅ Super admin account already exists.');
      return;
    }

    console.log('📝 Creating the required super admin account...');
    const superAdmin = await User.create({
      name: 'Super Admin',
      email: 'super@gmail.com',
      password: 'password123',
      role: 'super_admin',
      status: 'active',
      isVerified: true
    });
    console.log('✅ Super Admin created');

    console.log('\n📧 Default account created (hanya pertama kali):');
    console.log('   👑 Super Admin: super@gmail.com / password123\n');
    
  } catch (error) {
    console.error('❌ Error init database:', error);
  }
};

module.exports = initDatabase;