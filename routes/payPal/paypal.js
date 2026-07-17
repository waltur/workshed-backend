const express = require('express');

const router = express.Router();

const controller =
require('../../controllers/payPal/paypalController');

router.post('/create-order',
controller.createOrder);

router.post('/capture-order',
controller.captureOrder);

module.exports = router;