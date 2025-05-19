const express = require('express');
const router = express.Router();
const { getRoles } = require('../../controllers/role/roleController');

router.get('/', getRoles);

module.exports = router;