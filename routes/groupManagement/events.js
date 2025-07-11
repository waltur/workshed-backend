const express = require('express');
const router = express.Router();
const controller = require('../../controllers/groupManagement/groupEventsController');

router.post('/', controller.createEvent);
router.get('/group/:id', controller.getEventsByGroup);
router.get('/', controller.getAllEvents);
router.put('/events/:id', controller.updateEvent);
router.delete('/events/:id', controller.deleteEvent);
router.delete('/events/:id_event/tasks', controller.deleteTasksByEventId);
router.get('/:id_event/attendees', controller.getEventRegistrations);
router.patch('/:id_event/attendees/:id_contact', controller.updateAttendance);
router.post('/confirm-attendance', controller.saveSignature);
module.exports = router;