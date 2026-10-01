const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { DataTypes } = require('sequelize');
const { sequelize } = require('./models');
const initDatabase = require('./scripts/init-db');
const { startExpiryWorker } = require('./jobs/expire-orders');

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
const artistRoutes = require('./routes/artist.routes');
const orderRoutes = require('./routes/order.routes');
const paymentRoutes = require('./routes/payment.routes');
const promoRoutes = require('./routes/promo.routes');
const userRoutes = require('./routes/user.routes');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/organizer', organizerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/concerts', concertRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/users', userRoutes);
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

    const queryInterface = sequelize.getQueryInterface();
    try {
      const tables = await queryInterface.showAllTables();
      const hasTicketsTable = tables.some((table) => String(typeof table === 'object' ? table.tableName : table).toLowerCase() === 'tickets');
      const hasTicketScansTable = tables.some((table) => String(typeof table === 'object' ? table.tableName : table).toLowerCase() === 'ticketscans');
      const hasPaymentsTable = tables.some((table) => String(typeof table === 'object' ? table.tableName : table).toLowerCase() === 'payments');
      const hasSystemSettingsTable = tables.some((table) => String(typeof table === 'object' ? table.tableName : table).toLowerCase() === 'systemsettings');
      const hasGalleriesTable = tables.some((table) => String(typeof table === 'object' ? table.tableName : table).toLowerCase() === 'galleries');
      const hasAuditLogsTable = tables.some((table) => String(typeof table === 'object' ? table.tableName : table).toLowerCase() === 'auditlogs');

      if (hasSystemSettingsTable) {
        const systemSettingColumns = await queryInterface.describeTable('SystemSettings');
        if (!systemSettingColumns.updatedBy) {
          await queryInterface.addColumn('SystemSettings', 'updatedBy', {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          });
        }
        if (!systemSettingColumns.createdAt) {
          await queryInterface.addColumn('SystemSettings', 'createdAt', {
            type: DataTypes.DATE,
            allowNull: true
          });
          await sequelize.query('UPDATE `SystemSettings` SET `createdAt` = COALESCE(`updatedAt`, CURRENT_TIMESTAMP) WHERE `createdAt` IS NULL');
          await queryInterface.changeColumn('SystemSettings', 'createdAt', {
            type: DataTypes.DATE,
            allowNull: false
          });
        }
      }

      if (hasGalleriesTable) {
        const galleryColumns = await queryInterface.describeTable('Galleries');
        if (!galleryColumns.updatedAt) {
          await queryInterface.addColumn('Galleries', 'updatedAt', {
            type: DataTypes.DATE,
            allowNull: true
          });
          await sequelize.query('UPDATE `Galleries` SET `updatedAt` = COALESCE(`createdAt`, CURRENT_TIMESTAMP) WHERE `updatedAt` IS NULL');
          await queryInterface.changeColumn('Galleries', 'updatedAt', {
            type: DataTypes.DATE,
            allowNull: false
          });
        }
      }

      if (hasAuditLogsTable) {
        const auditLogColumns = await queryInterface.describeTable('AuditLogs');
        if (!auditLogColumns.updatedAt) {
          await queryInterface.addColumn('AuditLogs', 'updatedAt', {
            type: DataTypes.DATE,
            allowNull: true
          });
          await sequelize.query('UPDATE `AuditLogs` SET `updatedAt` = COALESCE(`createdAt`, CURRENT_TIMESTAMP) WHERE `updatedAt` IS NULL');
          await queryInterface.changeColumn('AuditLogs', 'updatedAt', {
            type: DataTypes.DATE,
            allowNull: false
          });
        }
      }

      if (hasPaymentsTable) {
        const paymentColumns = await queryInterface.describeTable('Payments');
        if (paymentColumns.orderId) {
          const paymentForeignKeys = await queryInterface.getForeignKeyReferencesForTable('Payments');
          const orderForeignKeys = paymentForeignKeys.filter((foreignKey) =>
            foreignKey.columnName.toLowerCase() === 'orderid' &&
            foreignKey.referencedTableName.toLowerCase() === 'orders' &&
            foreignKey.referencedColumnName.toLowerCase() === 'id'
          );
          const [foreignKeyRules] = await sequelize.query(`
            SELECT CONSTRAINT_NAME AS constraintName, DELETE_RULE AS deleteRule
            FROM information_schema.REFERENTIAL_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
          `);
          const hasRestrictConstraint = orderForeignKeys.length === 1 && foreignKeyRules.some((rule) =>
            rule.constraintName === orderForeignKeys[0].constraintName && rule.deleteRule === 'RESTRICT'
          );
          if (!hasRestrictConstraint) {
            for (const foreignKey of orderForeignKeys) {
              await queryInterface.removeConstraint('Payments', foreignKey.constraintName);
            }
            await queryInterface.addConstraint('Payments', {
              fields: ['orderId'],
              type: 'foreign key',
              name: 'payments_orderId_fk',
              references: { table: 'Orders', field: 'id' },
              onUpdate: 'CASCADE',
              onDelete: 'RESTRICT'
            });
          }
        }
      }

      if (hasTicketsTable) {
        const ticketColumns = await queryInterface.describeTable('Tickets');
        if (ticketColumns.orderId && !ticketColumns.orderId.allowNull) {
          const ticketForeignKeys = await queryInterface.getForeignKeyReferencesForTable('Tickets');
          const orderForeignKeys = ticketForeignKeys.filter((foreignKey) => foreignKey.columnName === 'orderId');
          for (const foreignKey of orderForeignKeys) {
            await queryInterface.removeConstraint('Tickets', foreignKey.constraintName);
          }
          await queryInterface.changeColumn('Tickets', 'orderId', {
            type: DataTypes.INTEGER,
            allowNull: true
          });
          await queryInterface.addConstraint('Tickets', {
            fields: ['orderId'],
            type: 'foreign key',
            name: 'tickets_orderId_fk',
            references: { table: 'Orders', field: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          });
        }
      }

      if (hasTicketScansTable) {
        const ticketScanColumns = await queryInterface.describeTable('TicketScans');
        if (ticketScanColumns.scannedBy && !ticketScanColumns.scannedBy.allowNull) {
          const scanForeignKeys = await queryInterface.getForeignKeyReferencesForTable('TicketScans');
          const scannedByForeignKeys = scanForeignKeys.filter((foreignKey) => foreignKey.columnName === 'scannedBy');
          for (const foreignKey of scannedByForeignKeys) {
            await queryInterface.removeConstraint('TicketScans', foreignKey.constraintName);
          }
          await queryInterface.changeColumn('TicketScans', 'scannedBy', {
            type: DataTypes.INTEGER,
            allowNull: true
          });
          await queryInterface.addConstraint('TicketScans', {
            fields: ['scannedBy'],
            type: 'foreign key',
            name: 'ticketscans_scannedBy_fk',
            references: { table: 'Users', field: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          });
        }
      }

      await sequelize.sync({ force: false });
    } catch (syncError) {
      console.error('⚠️ Database schema sync failed; the server will continue with the existing schema:', syncError);
    }
    console.log('✅ Database synchronized');

    await initDatabase();

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      startExpiryWorker();
    });
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Stop the existing server or run PowerShell: $env:PORT='5003'; npm run dev`);
      } else {
        console.error('❌ Failed to start HTTP server:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;