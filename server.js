const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { sequelize } = require('./models');
const initDatabase = require('./scripts/init-db');

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import routes
const authRoutes = require('./routes/auth.routes');
const customerRoutes = require('./routes/customer.routes');
const organizerRoutes = require('./routes/organizer.routes');
const venueRoutes = require('./routes/venue.routes');
const adminRoutes = require('./routes/admin.routes');
const superAdminRoutes = require('./routes/superAdmin.routes');
const concertRoutes = require('./routes/concert.routes');
const ticketRoutes = require('./routes/ticket.routes');
const galleryRoutes = require('./routes/gallery.routes');
const seatRoutes = require('./routes/seat.routes');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/organizer', organizerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/concerts', concertRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/seats', seatRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    // Sync hanya untuk model tertentu (skip Venue)
    // Atau gunakan force: false
    try {
      await sequelize.sync({ force: false, alter: true });
    } catch (syncError) {
      console.log('⚠️ Sync error, attempting to continue...');
      // Jika sync gagal, lanjutkan tanpa sync
    }
    console.log('✅ Database synchronized');

    await initDatabase();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;