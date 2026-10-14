// controllers/ticket.controller.js
const { Ticket, TicketScan, Concert, Order, User, sequelize } = require('../models');
const { verifyTicketQr } = require('../utils/ticketQr');

exports.getConcertScans = async (req, res) => {
  try {
    const concertId = Number(req.query.concertId);
    if (!Number.isInteger(concertId) || concertId <= 0) {
      return res.status(400).json({ success: false, message: 'A valid concert must be selected' });
    }

    const concert = await Concert.findByPk(concertId, { attributes: ['id', 'name', 'organizerId'] });
    if (!concert) return res.status(404).json({ success: false, message: 'Concert not found' });
    if (!['admin', 'super_admin'].includes(req.user.role) && Number(concert.organizerId) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view scans for this concert' });
    }

    const scans = await TicketScan.findAll({
      where: { scanStatus: 'accepted' },
      include: [
        {
          model: Ticket,
          as: 'ticket',
          required: true,
          attributes: ['id', 'ticketNumber', 'category', 'seatId'],
          where: { concertId },
          include: [
            { model: Order, as: 'order', attributes: ['id', 'orderNumber', 'customerName'] }
          ]
        },
        { model: User, as: 'scanner', attributes: ['id', 'name'] }
      ],
      order: [['scannedAt', 'DESC']],
      limit: 200
    });

    return res.json({
      success: true,
      data: { concert, scans }
    });
  } catch (error) {
    console.error('Get concert ticket scans error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load concert check-ins' });
  }
};

// ==================== GET ALL TICKETS ====================
exports.getTickets = async (req, res) => {
  try {
    const organizerId = req.user.id;
    const { concertId, category, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const where = { organizerId };

    if (concertId) where.concertId = concertId;
    if (category) where.category = category;

    const tickets = await Ticket.findAndCountAll({
      where,
      include: [
        { 
          model: Concert, 
          as: 'concert',
          attributes: ['id', 'name', 'date', 'venueName']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: tickets.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: tickets.count,
        totalPages: Math.ceil(tickets.count / limit)
      }
    });
  } catch (error) {
    console.error('❌ Get tickets error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== CREATE TICKET ====================
exports.createTicket = async (req, res) => {
  try {
    const organizerId = req.user.id;
    const { category, price, quota, concertId } = req.body;

    // Validasi
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }

    if (!price || price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid price is required'
      });
    }

    if (!quota || quota <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quota is required'
      });
    }

    if (!concertId) {
      return res.status(400).json({
        success: false,
        message: 'Concert ID is required'
      });
    }

    // Cek concert milik organizer
    const concert = await Concert.findOne({
      where: { id: concertId, organizerId }
    });

    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found or not owned by you'
      });
    }

    // Cek apakah ticket category sudah ada
    const existingTicket = await Ticket.findOne({
      where: { concertId, category }
    });

    if (existingTicket) {
      return res.status(400).json({
        success: false,
        message: `Ticket category "${category}" already exists for this concert`
      });
    }

    const ticket = await Ticket.create({
      organizerId,
      concertId,
      category,
      price,
      quota,
      available: quota,
      sold: 0,
      status: 'active'
    });

    // Update concert min/max price
    await updateConcertPrices(concertId);

    res.status(201).json({
      success: true,
      data: ticket,
      message: 'Ticket created successfully'
    });
  } catch (error) {
    console.error('❌ Create ticket error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== UPDATE TICKET ====================
exports.updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const organizerId = req.user.id;
    const { category, price, quota, status } = req.body;

    const ticket = await Ticket.findOne({
      where: { id, organizerId }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Update data
    const updateData = {};
    if (category) updateData.category = category;
    if (price) {
      updateData.price = price;
      updateData.available = (quota || ticket.quota) - ticket.sold;
    }
    if (quota) {
      updateData.quota = quota;
      updateData.available = quota - ticket.sold;
    }
    if (status) updateData.status = status;

    await ticket.update(updateData);

    // Update concert prices
    await updateConcertPrices(ticket.concertId);

    res.json({
      success: true,
      data: ticket,
      message: 'Ticket updated successfully'
    });
  } catch (error) {
    console.error('❌ Update ticket error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== DELETE TICKET ====================
exports.deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const organizerId = req.user.id;

    const ticket = await Ticket.findOne({
      where: { id, organizerId }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Cek apakah ada yang sudah terjual
    if (ticket.sold > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete ticket with ${ticket.sold} sold`
      });
    }

    await ticket.destroy();

    // Update concert prices
    await updateConcertPrices(ticket.concertId);

    res.json({
      success: true,
      message: 'Ticket deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete ticket error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== HELPER: Update Concert Prices ====================
async function updateConcertPrices(concertId) {
  try {
    const tickets = await Ticket.findAll({
      where: { concertId, status: 'active' }
    });

    if (tickets.length === 0) {
      await Concert.update(
        { minPrice: 0, maxPrice: 0 },
        { where: { id: concertId } }
      );
      return;
    }

    const prices = tickets.map(t => parseFloat(t.price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    await Concert.update(
      { minPrice, maxPrice },
      { where: { id: concertId } }
    );
  } catch (error) {
    console.error('❌ Update concert prices error:', error);
  }
}

exports.scanTicket = async (req, res) => {
  const payload = verifyTicketQr(req.body.code);
  if (!payload?.ticketId || !payload.ticketNumber) {
    return res.status(400).json({ success: false, message: 'Invalid or unsigned ticket QR' });
  }
  const selectedConcertId = Number(req.body.concertId);
  if (!Number.isInteger(selectedConcertId) || selectedConcertId <= 0) {
    return res.status(400).json({ success: false, message: 'Select a concert before scanning tickets' });
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const ticket = await Ticket.findByPk(payload.ticketId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!ticket || ticket.ticketNumber !== payload.ticketNumber || Number(ticket.concertId) !== Number(payload.concertId) || Number(ticket.orderId) !== Number(payload.orderId)) {
        return { status: 404, body: { success: false, message: 'Ticket not found' } };
      }

      const concert = await Concert.findByPk(ticket.concertId, { transaction });
      if (!concert) return { status: 404, body: { success: false, message: 'Concert not found' } };
      if (!['admin', 'super_admin'].includes(req.user.role) && Number(concert.organizerId) !== Number(req.user.id)) {
        return { status: 403, body: { success: false, message: 'Not authorized to scan tickets for this concert' } };
      }
      if (Number(ticket.concertId) !== selectedConcertId) {
        return { status: 409, body: { success: false, message: 'This ticket belongs to a different concert', scanStatus: 'invalid' } };
      }

      const order = await Order.findByPk(ticket.orderId, { transaction });
      if (!order || order.status !== 'paid') {
        await TicketScan.create({ ticketId: ticket.id, scannedBy: req.user.id, scanStatus: 'invalid' }, { transaction });
        return { status: 409, body: { success: false, message: 'Ticket order is not paid', scanStatus: 'invalid' } };
      }

      if (ticket.status === 'used') {
        await TicketScan.create({ ticketId: ticket.id, scannedBy: req.user.id, scanStatus: 'duplicate' }, { transaction });
        return { status: 409, body: { success: false, message: 'Ticket has already been scanned', scanStatus: 'duplicate' } };
      }
      if (ticket.status !== 'active') {
        await TicketScan.create({ ticketId: ticket.id, scannedBy: req.user.id, scanStatus: 'invalid' }, { transaction });
        return { status: 409, body: { success: false, message: 'Ticket is not valid for entry', scanStatus: 'invalid' } };
      }

      await ticket.update({ status: 'used' }, { transaction });
      await TicketScan.create({ ticketId: ticket.id, scannedBy: req.user.id, scanStatus: 'accepted' }, { transaction });
      return {
        status: 200,
        body: {
          success: true,
          message: 'Ticket accepted',
          data: {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            customerName: order.customerName,
            concertId: concert.id,
            concert: concert.name,
            scannedAt: new Date().toISOString()
          }
        }
      };
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Ticket scan error:', error);
    return res.status(500).json({ success: false, message: 'Failed to validate ticket' });
  }
};