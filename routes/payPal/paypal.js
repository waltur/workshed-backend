const express = require('express');
const router = express.Router();
const verifyToken =   require('../../middleware/verifyToken');

const controller =
require('../../controllers/payPal/paypalController');

router.post('/create-order',controller.createOrder);

router.post('/capture-order',  verifyToken,controller.captureOrder);

router.post('/capture-registration-order', controller.captureRegistrationOrder);

module.exports = router;