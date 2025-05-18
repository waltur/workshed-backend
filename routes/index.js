const express = require('express');
const router = express.Router();
const { getWelcomeMessage } = require('../controller/basicController');

router.get('/hello', getWelcomeMessage);

module.exports = router;
