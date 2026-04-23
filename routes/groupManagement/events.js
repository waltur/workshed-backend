const express = require('express');
const router = express.Router();
const controller = require('../../controllers/groupManagement/groupEventsController');

// 🔥 PRIMERO rutas específicas
router.get('/group/:id', controller.getEventsByGroup);
router.get('/my-events-count', controller.getMyEventsCount);

router.get('/:id_event/attendees', controller.getEventRegistrations);
router.patch('/:id_event/attendees/:id_contact', controller.updateAttendance);

// 🔥 LUEGO rutas de eventos
router.post('/', controller.createEvent);
router.get('/', controller.getAllEvents);

router.put('/events/series/:series_id', controller.updateEventSeries);
router.put('/events/:id', controller.updateEvent);

router.delete('/events/:id_event/tasks', controller.deleteTasksByEventId);
router.delete('/events/:id', controller.deleteEvent);

// 🔥 FINAL
router.post('/confirm-attendance', controller.saveSignature);

module.exports = router;