const express = require('express');

const router = express.Router();
const verifyToken = require('../../middleware/verifyToken');
const { getMembershipStatus } = require('../../controllers/membership/membershipController');



router.get('/status', verifyToken, getMembershipStatus);

module.exports = router;