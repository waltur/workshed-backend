const express = require('express');
const router = express.Router();
const controller = require('../../controllers/groupManagement/groupsController');
const verifyToken = require('../../middleware/verifyToken');

router.get('/', controller.getGroups);
router.get('/:id', controller.getGroupById);
router.post('/', controller.createGroup);
router.put('/:id', controller.updateGroup);
router.delete('/:id', controller.deleteGroup);
router.get('/:id/members', controller.getGroupMembers);
router.post('/:id/members', controller.addGroupMember);
router.delete('/:id/members/:memberId', controller.removeGroupMember);
router.get('/:id_event/attendance-report', controller.getEventAttendanceReport);
router.delete('/:id/booking',verifyToken, controller.cancelBooking);

module.exports = router;