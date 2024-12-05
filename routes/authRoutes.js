const express = require('express');
const { authMiniApp } = require('../controllers/authController');

const router = express.Router();

router.post('/miniapp', authMiniApp);

module.exports = router;