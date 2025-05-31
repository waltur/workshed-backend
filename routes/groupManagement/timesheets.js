const express = require('express');
const router = express.Router();
const controller = require('../../controllers/groupManagement/groupTimesheetsController');

router.post('/', controller.createTimesheet);
router.get('/event/:id', controller.getTimesheetsByEvent);

module.exports = router;