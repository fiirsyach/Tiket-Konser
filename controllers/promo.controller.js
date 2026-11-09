const { Promotion, Order } = require('../models');
const { Op } = require('sequelize');

// @desc    Get all promotions
// @route   GET /api/promos
exports.getPromotions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (status) where.status = status;
    if (type) where.type = type;

    const promotions = await Promotion.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: promotions.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: promotions.count,
        totalPages: Math.ceil(promotions.count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get active promotions
// @route   GET /api/promos/active
exports.getActivePromotions = async (req, res) => {
  try {
    const now = new Date();
    const promotions = await Promotion.findAll({
      where: {
        status: 'active',
        startDate: { [Op.lte]: now },
        endDate: { [Op.gte]: now }
      },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: promotions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Validate promo code
// @route   GET /api/promos/validate
exports.validatePromoCode = async (req, res) => {
  try {
    const { code, subtotal, concertId } = req.query;
    const purchaseSubtotal = Number(subtotal);
    const numericConcertId = Number(concertId);

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Promo code is required'
      });
    }
    if (!Number.isFinite(purchaseSubtotal) || purchaseSubtotal < 0 ||
      !Number.isInteger(numericConcertId) || numericConcertId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid subtotal and concert are required'
      });
    }

    const promo = await Promotion.findOne({
      where: {
        code: String(code).trim().toUpperCase(),
        status: 'active',
        startDate: { [Op.lte]: new Date() },
        endDate: { [Op.gte]: new Date() }
      }
    });

    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired promo code'
      });
    }

    if (promo.concertId && Number(promo.concertId) !== numericConcertId) {
      return res.status(400).json({
        success: false,
        message: 'Promo code does not apply to this concert'
      });
    }

    if (promo.minPurchase && purchaseSubtotal < Number(promo.minPurchase)) {
      return res.status(400).json({
        success: false,
        message: 'Minimum purchase requirement is not met'
      });
    }

    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      return res.status(400).json({
        success: false,
        message: 'Promo code has reached maximum usage'
      });
    }

    const usedOrders = await Order.count({
      where: {
        userId: req.user.id,
        promotionId: promo.id,
        [Op.or]: [
          { status: 'paid' },
          { status: 'pending', expiryDate: { [Op.gt]: new Date() } }
        ]
      }
    });
    if (promo.perUserLimit && usedOrders >= promo.perUserLimit) {
      return res.status(400).json({
        success: false,
        message: 'You have reached this promotion usage limit'
      });
    }

    const amountBeforeDiscount = purchaseSubtotal * 1.05;
    const discount = promo.discountType === 'percentage'
      ? Math.min(
        amountBeforeDiscount * (Number(promo.value) / 100),
        Number(promo.maxDiscount ?? amountBeforeDiscount)
      )
      : Math.min(Number(promo.value), amountBeforeDiscount);

    return res.json({
      success: true,
      data: {
        code: promo.code,
        name: promo.name,
        type: promo.type,
        discountType: promo.discountType,
        value: promo.value,
        discount,
        valid: true
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single promotion
// @route   GET /api/promos/:id
exports.getPromotion = async (req, res) => {
  try {
    const promotion = await Promotion.findByPk(req.params.id);
    
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    res.json({
      success: true,
      data: promotion
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create promotion
// @route   POST /api/promos
exports.createPromotion = async (req, res) => {
  try {
    const { 
      code, 
      name, 
      description, 
      type, 
      value, 
      discountType,
      minPurchase,
      maxDiscount,
      startDate, 
      endDate, 
      maxUses,
      perUserLimit,
      concertId
    } = req.body;

    // Check if code exists
    const existing = await Promotion.findOne({ where: { code: code.toUpperCase() } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Promo code already exists'
      });
    }

    const promotion = await Promotion.create({
      code: code.toUpperCase(),
      name,
      description,
      type,
      value,
      discountType: discountType || 'percentage',
      minPurchase,
      maxDiscount,
      startDate,
      endDate,
      maxUses,
      perUserLimit: perUserLimit || 1,
      concertId: concertId || null
    });

    res.status(201).json({
      success: true,
      data: promotion
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update promotion
// @route   PUT /api/promos/:id
exports.updatePromotion = async (req, res) => {
  try {
    const promotion = await Promotion.findByPk(req.params.id);
    
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    const updateData = { ...req.body };
    if (updateData.code) {
      updateData.code = updateData.code.toUpperCase();
    }

    await promotion.update(updateData);

    res.json({
      success: true,
      data: promotion
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete promotion
// @route   DELETE /api/promos/:id
exports.deletePromotion = async (req, res) => {
  try {
    const promotion = await Promotion.findByPk(req.params.id);
    
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    await promotion.destroy();

    res.json({
      success: true,
      message: 'Promotion deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};