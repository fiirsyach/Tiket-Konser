// controllers/gallery.controller.js
const { Gallery, Concert } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

// ==================== GET GALLERY BY CONCERT ====================
exports.getGalleryByConcert = async (req, res) => {
  try {
    const { concertId } = req.params;

    const concert = await Concert.findByPk(concertId);
    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found'
      });
    }

    const gallery = await Gallery.findAll({
      where: { concertId },
      order: [['order', 'ASC'], ['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: gallery
    });
  } catch (error) {
    console.error('❌ Get gallery by concert error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== UPLOAD GALLERY ====================
exports.uploadGallery = async (req, res) => {
  try {
    const organizerId = req.user?.id;
    
    console.log("🔍 ===== UPLOAD GALLERY REQUEST =====");
    console.log("📝 req.body:", req.body);
    console.log("📝 req.file:", req.file ? req.file.filename : 'NO FILE');
    console.log("📝 req.params:", req.params);
    console.log("📝 req.user:", req.user);
    console.log("=====================================");

    // ============ CONCERT DEBUG ============
    const { concertId } = req.body;
    
    console.log("========== CONCERT DEBUG ==========");
    console.log("req.user:", req.user);
    console.log("organizerId:", organizerId);
    console.log("concertId:", concertId);
    console.log("typeof concertId:", typeof concertId);
    console.log("====================================");

    if (!concertId) {
      console.log("❌ concertId is empty or undefined!");
      return res.status(400).json({
        success: false,
        message: 'Concert ID is required. Please select a concert.'
      });
    }

    const concertIdNum = parseInt(concertId);
    console.log("📝 concertIdNum:", concertIdNum, "typeof:", typeof concertIdNum);

    if (!Number.isInteger(concertIdNum) || concertIdNum <= 0) {
      console.log("❌ concertId is not a valid number!");
      return res.status(400).json({
        success: false,
        message: 'Invalid Concert ID. Please select a valid concert.'
      });
    }

    if (!organizerId) {
      console.log("❌ organizerId is missing!");
      return res.status(401).json({
        success: false,
        message: 'Organizer ID tidak ditemukan'
      });
    }

    // ============ CEK CONCERT ============
    console.log("🔍 Looking for concert:", concertIdNum, "organizer:", organizerId);
    
    const concert = await Concert.findOne({
      where: {
        id: concertIdNum,
        organizerId: organizerId
      }
    });

    if (!concert) {
      console.log("❌ Concert not found!");
      return res.status(404).json({
        success: false,
        message: 'Concert not found or not owned by you'
      });
    }

    console.log("✅ Concert found:", concert.id, concert.name);

    // ============ CEK FILE ============
    if (!req.file) {
      console.log("❌ No file uploaded!");
      return res.status(400).json({
        success: false,
        message: 'Image file is required'
      });
    }

    console.log("✅ File uploaded:", req.file.filename);

    // ============ CREATE GALLERY ============
    const gallery = await Gallery.create({
      concertId: concertIdNum,
      image: `/uploads/gallery/${req.file.filename}`,
      caption: req.body.caption || null,
      type: req.body.type || 'photo',
      isFeatured: req.body.isFeatured || false,
      order: req.body.order || 0
    });

    console.log("✅ Gallery created:", gallery.id);

    res.status(201).json({
      success: true,
      data: gallery,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error("❌ Upload gallery error:", error);
    console.error("📚 Stack:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload image'
    });
  }
};

// ==================== UPDATE GALLERY ====================
exports.updateGallery = async (req, res) => {
  try {
    const { id } = req.params;
    const organizerId = req.user.id;
    const { caption, type, isFeatured, order } = req.body;

    const gallery = await Gallery.findOne({
      where: { id },
      include: [{ 
        model: Concert, 
        as: 'concert',
        where: { organizerId }
      }]
    });

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: 'Gallery item not found'
      });
    }

    await gallery.update({
      caption: caption !== undefined ? caption : gallery.caption,
      type: type || gallery.type,
      isFeatured: isFeatured !== undefined ? isFeatured : gallery.isFeatured,
      order: order !== undefined ? order : gallery.order
    });

    res.json({
      success: true,
      data: gallery,
      message: 'Gallery updated successfully'
    });
  } catch (error) {
    console.error('❌ Update gallery error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== DELETE GALLERY ====================
exports.deleteGallery = async (req, res) => {
  try {
    const { id } = req.params;
    const organizerId = req.user.id;

    console.log('🔍 Delete gallery:', id, 'organizer:', organizerId);

    const gallery = await Gallery.findOne({
      where: { id },
      include: [{ 
        model: Concert, 
        as: 'concert',
        where: { organizerId }
      }]
    });

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: 'Gallery item not found'
      });
    }

    // Hapus file dari storage
    if (gallery.image) {
      const filePath = path.join(__dirname, '../public', gallery.image);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('✅ File deleted:', filePath);
      }
    }

    await gallery.destroy();

    res.json({
      success: true,
      message: 'Gallery deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete gallery error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getGallery = async (req, res) => {
  try {
    const organizerId = req.user.id;
    const { concertId } = req.query;

    console.log('🔍 Get gallery for organizer:', organizerId, 'concertId:', concertId);

    // Build where condition for concerts
    const concertWhere = { organizerId };
    if (concertId) {
      concertWhere.id = parseInt(concertId);
    }

    const concerts = await Concert.findAll({
      where: concertWhere,
      attributes: ['id']
    });

    const concertIds = concerts.map(c => c.id);

    if (concertIds.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    const gallery = await Gallery.findAll({
      where: { concertId: { [Op.in]: concertIds } },
      include: [
        { 
          model: Concert, 
          as: 'concert', 
          attributes: ['id', 'name', 'venueName'] 
        }
      ],
      order: [['order', 'ASC'], ['createdAt', 'DESC']]
    });

    console.log('✅ Gallery found:', gallery.length);

    res.json({
      success: true,
      data: gallery
    });
  } catch (error) {
    console.error('❌ Get gallery error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ==================== UPLOAD CONCERT THUMBNAIL ====================
exports.uploadThumbnail = async (req, res) => {
  try {
    const { concertId } = req.params;
    const organizerId = req.user.id;

    const concert = await Concert.findOne({
      where: { id: concertId, organizerId }
    });

    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found or not owned by you'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Image file is required'
      });
    }

    // Hapus thumbnail lama jika ada
    if (concert.thumbnail) {
      const oldPath = path.join(__dirname, '../public', concert.thumbnail);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await concert.update({
      thumbnail: `/uploads/concerts/${req.file.filename}`
    });

    res.json({
      success: true,
      data: concert,
      message: 'Thumbnail uploaded successfully'
    });
  } catch (error) {
    console.error('❌ Upload thumbnail error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== UPLOAD CONCERT BANNER ====================
exports.uploadBanner = async (req, res) => {
  try {
    const { concertId } = req.params;
    const organizerId = req.user.id;

    const concert = await Concert.findOne({
      where: { id: concertId, organizerId }
    });

    if (!concert) {
      return res.status(404).json({
        success: false,
        message: 'Concert not found or not owned by you'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Image file is required'
      });
    }

    // Hapus banner lama jika ada
    if (concert.banner) {
      const oldPath = path.join(__dirname, '../public', concert.banner);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await concert.update({
      banner: `/uploads/concerts/${req.file.filename}`
    });

    res.json({
      success: true,
      data: concert,
      message: 'Banner uploaded successfully'
    });
  } catch (error) {
    console.error('❌ Upload banner error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};