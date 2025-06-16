const express = require('express');
const router = express.Router();
const { createEventTask, getTasksByEvent } = require('../../controllers/groupManagement/groupTasksController');

router.post('/', createEventTask);
router.get('/:id_event', getTasksByEvent);

module.exports = router;