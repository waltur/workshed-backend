const express = require('express');
const router = express.Router();
const { getRoles, getAdminRoles } = require('../../controllers/role/roleController');

const verifyToken = require('../../middleware/verifyToken');
const authorize = require('../../middleware/authorize');

router.get('/', getRoles);
router.get(
  '/admin-roles',
  verifyToken,
  authorize('Committee'),
  getAdminRoles
);
module.exports = router;