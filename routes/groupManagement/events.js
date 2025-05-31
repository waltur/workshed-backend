const express = require('express');
const router = express.Router();
const controller = require('../../controllers/groupManagement/groupEventsController');

router.post('/', controller.createEvent);
router.get('/group/:id', controller.getEventsByGroup);
router.get('/', controller.getAllEvents);

module.exports = router;