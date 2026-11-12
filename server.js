const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { sequelize } = require('./models');
const initDatabase = require('./scripts/init-db');
const { startExpiryWorker } = require('./jobs/expire-orders');

dotenv.config();

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    const isLocalDevelopmentOrigin = process.env.NODE_ENV !== 'production' &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
    if (!origin || allowedOrigins.includes(origin) || isLocalDevelopmentOrigin) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
const orderRoutes = require('./routes/order.routes');
const paymentRoutes = require('./routes/payment.routes');
const promoRoutes = require('./routes/promo.routes');
const userRoutes = require('./routes/user.routes');
const siteSettingsRoutes = require('./routes/siteSettings.routes');

app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/organizer', organizerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/concerts', concertRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/users', userRoutes);
app.use('/api/site-settings', siteSettingsRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/seats', seatRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

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
    console.log('Database connection established.');
    await sequelize.sync();
    console.log('Database synchronized.');
    await initDatabase();

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startExpiryWorker();
    });
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the existing server or run PowerShell: $env:PORT='5003'; npm run dev`);
      } else {
        console.error('Failed to start HTTP server:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
