const express = require('express');
const router = express.Router();
const controller = require('../../controllers/groupManagement/groupsController');

router.get('/', controller.getGroups);
router.get('/:id', controller.getGroupById);
router.post('/', controller.createGroup);
router.put('/:id', controller.updateGroup);
router.delete('/:id', controller.deleteGroup);
router.get('/:id/members', controller.getGroupMembers);
router.post('/:id/members', controller.addGroupMember);
router.delete('/:id/members/:memberId', controller.removeGroupMember);

module.exports = router;