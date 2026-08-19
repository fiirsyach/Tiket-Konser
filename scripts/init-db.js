const { User, OrganizerProfile, Venue, Artist, Category } = require('../models');
const bcrypt = require('bcrypt');

const initDatabase = async () => {
  try {
    // CEK APAKAH SUDAH ADA USER
    const userCount = await User.count();
    
    // JIKA SUDAH ADA USER, SKIP SEEDING
    if (userCount > 0) {
      console.log(`✅ Database sudah memiliki ${userCount} users.`);
      console.log('📧 Gunakan akun yang sudah ada atau register baru.');
      return;
    }

    // JIKA TIDAK ADA USER (DATABASE KOSONG), BARU SEEDING
    console.log('📝 Database kosong! Seeding data awal...');
    
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Buat Super Admin
    const superAdmin = await User.create({
      name: 'Super Admin',
      email: 'super@gmail.com',
      password: hashedPassword,
      role: 'super_admin',
      status: 'active',
      isVerified: true
    });
    console.log('✅ Super Admin created');

    // Buat Customer
    const customer = await User.create({
      name: 'Customer User',
      email: 'customer@example.com',
      password: hashedPassword,
      role: 'customer',
      status: 'active',
      isVerified: true
    });
    console.log('✅ Customer created');

    // Buat Organizer
    const organizer = await User.create({
      name: 'Organizer User',
      email: 'organizer@example.com',
      password: hashedPassword,
      role: 'organizer',
      status: 'active',
      isVerified: true
    });
    console.log('✅ Organizer created');

    // Buat Organizer Profile
    await OrganizerProfile.create({
      userId: organizer.id,
      companyName: 'Event Pro Indonesia',
      description: 'Perusahaan event organizer terbaik',
      city: 'Jakarta',
      address: 'Jl. Sudirman No. 1, Jakarta',
      verificationStatus: 'approved',
      verified: true
    });
    console.log('✅ Organizer Profile created');

    // Buat Venue (jika model Venue ada)
    try {
      const venue = await Venue.create({
        name: 'Jakarta Convention Center',
        slug: 'jakarta-convention-center',
        city: 'Jakarta',
        address: 'Jl. Gatot Subroto No. 1, Jakarta',
        capacity: 5000
      });
      console.log('✅ Venue created');
    } catch (error) {
      console.log('⚠️ Venue sudah ada atau model tidak tersedia');
    }

    // Buat Artist (jika model Artist ada)
    try {
      const artist = await Artist.create({
        name: 'Test Artist',
        slug: 'test-artist',
        genre: 'Pop'
      });
      console.log('✅ Artist created');
    } catch (error) {
      console.log('⚠️ Artist sudah ada atau model tidak tersedia');
    }

    // Buat Category (jika model Category ada)
    try {
      const category = await Category.create({
        name: 'Concert',
        slug: 'concert',
        description: 'Concert category'
      });
      console.log('✅ Category created');
    } catch (error) {
      console.log('⚠️ Category sudah ada atau model tidak tersedia');
    }

    console.log('\n📧 Default users created (hanya pertama kali):');
    console.log('   👑 Super Admin: super@gmail.com / password123');
    console.log('   🎫 Customer: customer@example.com / password123');
    console.log('   🏢 Organizer: organizer@example.com / password123\n');
    
  } catch (error) {
    console.error('❌ Error init database:', error);
  }
};

module.exports = initDatabase;