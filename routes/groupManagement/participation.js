const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/groupManagement/groupEventParticipationController');

router.post('/attendee', ctrl.registerAttendee);
router.post('/instructor', ctrl.registerInstructor);
router.post('/helper', ctrl.registerHelper);
router.get('/group-roles', ctrl.getGroupRoles);

module.exports = router;