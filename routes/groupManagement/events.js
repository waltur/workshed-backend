const express = require('express');
const router = express.Router();
const controller = require('../../controllers/groupManagement/groupEventsController');

router.post('/', controller.createEvent);
router.get('/group/:id', controller.getEventsByGroup);
router.get('/', controller.getAllEvents);
router.put('/events/:id', controller.updateEvent);
router.delete('/events/:id', controller.deleteEvent);

module.exports = router;