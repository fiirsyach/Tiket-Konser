const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdmin.controller');

router.get('/public', superAdminController.getPublicSiteSettings);

module.exports = router;
