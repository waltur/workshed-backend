const express = require('express');

const router = express.Router();

const { getMembersReport } = require('../../controllers/reports/reportsController');

router.get('/members', getMembersReport);

module.exports = router;