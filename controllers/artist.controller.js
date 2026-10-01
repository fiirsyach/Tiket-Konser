const { Artist, Concert } = require('../models');
const { Op } = require('sequelize');
const slugify = require('slugify');

// @desc    Get all artists
// @route   GET /api/artists
exports.getArtists = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (search) {
      where.name = { [Op.like]: `%${search}%` };
    }

    const artists = await Artist.findAndCountAll({
      where,
      include: [{ 
        model: Concert,
        where: { status: { [Op.in]: ['published', 'on_sale', 'upcoming', 'approved'] } },
        required: false,
        attributes: ['id', 'name', 'date']
      }],
      order: [['followers', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    res.json({
      success: true,
      data: artists.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: artists.count,
        totalPages: Math.ceil(artists.count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single artist
// @route   GET /api/artists/:id
exports.getArtist = async (req, res) => {
  try {
    const artist = await Artist.findByPk(req.params.id, {
      include: [
        { 
          model: Concert,
          where: { status: { [Op.in]: ['published', 'on_sale', 'upcoming', 'approved'] } },
          required: false,
          include: [{ model: Venue }]
        }
      ]
    });

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: 'Artist not found'
      });
    }

    res.json({
      success: true,
      data: artist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get featured artists
// @route   GET /api/artists/featured
exports.getFeaturedArtists = async (req, res) => {
  try {
    const artists = await Artist.findAll({
      where: { isFeatured: true, status: 'active' },
      limit: 10,
      order: [['followers', 'DESC']]
    });

    res.json({
      success: true,
      data: artists
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Search artists
// @route   GET /api/artists/search
exports.searchArtists = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const artists = await Artist.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { biography: { [Op.like]: `%${q}%` } },
          { genre: { [Op.like]: `%${q}%` } }
        ]
      },
      limit: 20
    });

    res.json({
      success: true,
      data: artists
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create artist
// @route   POST /api/artists
exports.createArtist = async (req, res) => {
  try {
    const { name, biography, genre, instagram, spotify, youtube, twitter, website } = req.body;
    
    const slug = slugify(name, { lower: true, strict: true });

    const artist = await Artist.create({
      name,
      slug,
      biography,
      genre,
      instagram,
      spotify,
      youtube,
      twitter,
      website,
      photo: req.file ? `/uploads/artists/${req.file.filename}` : null
    });

    res.status(201).json({
      success: true,
      data: artist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update artist
// @route   PUT /api/artists/:id
exports.updateArtist = async (req, res) => {
  try {
    const artist = await Artist.findByPk(req.params.id);
    
    if (!artist) {
      return res.status(404).json({
        success: false,
        message: 'Artist not found'
      });
    }

    const updateData = req.body;
    if (req.file) {
      updateData.photo = `/uploads/artists/${req.file.filename}`;
    }

    await artist.update(updateData);

    res.json({
      success: true,
      data: artist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete artist
// @route   DELETE /api/artists/:id
exports.deleteArtist = async (req, res) => {
  try {
    const artist = await Artist.findByPk(req.params.id);
    
    if (!artist) {
      return res.status(404).json({
        success: false,
        message: 'Artist not found'
      });
    }

    await artist.destroy();

    res.json({
      success: true,
      message: 'Artist deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};