const sequelize = require('../config/database');

// Import all models
const User = require('./User');
const OrganizerProfile = require('./OrganizerProfile');
const Artist = require('./Artist');
const Concert = require('./Concert');
const Venue = require('./Venue');
const Seat = require('./Seat');
const Ticket = require('./Ticket');
const TicketCategory = require('./TicketCategory');
const TicketScan = require('./TicketScan');
const Order = require('./Order');
const Payment = require('./Payment');
const Withdrawal = require('./Withdrawal');
const Category = require('./Category');
const Review = require('./Review');
const Favorite = require('./Favorite');
const Promotion = require('./Promotion');
const Notification = require('./Notification');
const News = require('./News');
const Gallery = require('./Gallery');
const AuditLog = require('./AuditLog');
const SystemSetting = require('./SystemSetting');

// ==================== USER RELATIONSHIPS ====================
User.hasOne(OrganizerProfile, { foreignKey: 'userId', as: 'organizerProfile' });
OrganizerProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Concert, { foreignKey: 'organizerId', as: 'organizerConcerts' });
Concert.belongsTo(User, { foreignKey: 'organizerId', as: 'organizer' });

User.hasMany(Order, { foreignKey: 'userId', as: 'userOrders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Review, { foreignKey: 'userId', as: 'userReviews' });
Review.belongsTo(User, { foreignKey: 'userId', as: 'reviewer' });

User.hasMany(Favorite, { foreignKey: 'userId', as: 'userFavorites' });
Favorite.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'userNotifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(AuditLog, { foreignKey: 'userId', as: 'userAuditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Withdrawal, { foreignKey: 'organizerId', as: 'organizerWithdrawals' });
Withdrawal.belongsTo(User, { foreignKey: 'organizerId', as: 'organizer' });

// ==================== CONCERT RELATIONSHIPS ====================
Concert.hasMany(Ticket, { foreignKey: 'concertId', as: 'concertTickets' });
Ticket.belongsTo(Concert, { foreignKey: 'concertId', as: 'concert' });
Concert.hasMany(TicketCategory, { foreignKey: 'concertId', as: 'ticketCategories' });
TicketCategory.belongsTo(Concert, { foreignKey: 'concertId', as: 'concert' });
User.hasMany(TicketCategory, { foreignKey: 'organizerId', as: 'organizerTicketCategories' });
TicketCategory.belongsTo(User, { foreignKey: 'organizerId', as: 'organizer' });

Concert.hasMany(Review, { foreignKey: 'concertId', as: 'concertReviews' });
Review.belongsTo(Concert, { foreignKey: 'concertId', as: 'concert' });

Concert.hasMany(Gallery, { foreignKey: 'concertId', as: 'concertGalleries' });
Gallery.belongsTo(Concert, { foreignKey: 'concertId', as: 'concert' });

Concert.hasMany(Seat, { foreignKey: 'concertId', as: 'concertSeats' });
Seat.belongsTo(Concert, { foreignKey: 'concertId', as: 'concert' });

Concert.hasMany(Order, { foreignKey: 'concertId', as: 'concertOrders' });
Order.belongsTo(Concert, { foreignKey: 'concertId', as: 'concert' });

Concert.hasMany(Favorite, { foreignKey: 'concertId', as: 'concertFavorites' });
Favorite.belongsTo(Concert, { foreignKey: 'concertId', as: 'concert' });

Concert.belongsTo(Venue, { foreignKey: 'venueId', as: 'venue' });
Venue.hasMany(Concert, { foreignKey: 'venueId', as: 'concerts' });

Concert.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Category.hasMany(Concert, { foreignKey: 'categoryId', as: 'categoryConcerts' });

Concert.belongsTo(Artist, { foreignKey: 'artistId', as: 'artist' });
Artist.hasMany(Concert, { foreignKey: 'artistId', as: 'artistConcerts' });

// ==================== ORDER RELATIONSHIPS ====================
Order.hasMany(Ticket, { foreignKey: 'orderId', as: 'orderTickets' });
Ticket.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

Order.hasOne(Payment, { foreignKey: 'orderId', as: 'orderPayment', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
Payment.belongsTo(Order, { foreignKey: 'orderId', as: 'order', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });

Order.belongsTo(Promotion, { foreignKey: 'promotionId', as: 'promotion' });
Promotion.hasMany(Order, { foreignKey: 'promotionId', as: 'promotionOrders' });

// ==================== SEAT RELATIONSHIPS ====================
Seat.hasOne(Ticket, { foreignKey: 'seatId', as: 'seatTicket' });
Ticket.belongsTo(Seat, { foreignKey: 'seatId', as: 'seat' });
TicketCategory.hasMany(Ticket, { foreignKey: 'ticketCategoryId', as: 'issuedTickets' });
Ticket.belongsTo(TicketCategory, { foreignKey: 'ticketCategoryId', as: 'ticketCategory' });
Ticket.hasMany(TicketScan, { foreignKey: 'ticketId', as: 'scans' });
TicketScan.belongsTo(Ticket, { foreignKey: 'ticketId', as: 'ticket' });
User.hasMany(TicketScan, { foreignKey: 'scannedBy', as: 'ticketScans' });
TicketScan.belongsTo(User, { foreignKey: 'scannedBy', as: 'scanner' });

// ==================== TICKET RELATIONSHIPS ====================
// Ticket - User (organizer) - HAPUS INI UNTUK SEMENTARA
// Ticket.belongsTo(User, { foreignKey: 'organizerId', as: 'organizer' });
// User.hasMany(Ticket, { foreignKey: 'organizerId', as: 'organizerTickets' });

// ==================== EXPORTS ====================
module.exports = {
  sequelize,
  User,
  OrganizerProfile,
  Artist,
  Concert,
  Venue,
  Seat,
  Ticket,
  TicketCategory,
  TicketScan,
  Order,
  Payment,
  Withdrawal,
  Category,
  Review,
  Favorite,
  Promotion,
  Notification,
  News,
  Gallery,
  AuditLog,
  SystemSetting
};