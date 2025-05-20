const express = require('express');
const router = express.Router();
const { getJobRoles } = require('../../controllers/jobRole/jobRoleController');

router.get('/', getJobRoles);

module.exports = router;