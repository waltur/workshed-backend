const express = require('express');
const router = express.Router();
const {
  getAllVolunteers,
  createVolunteer,
} = require('../../controllers/volunteers/volunteerController');

router.get('/', getAllVolunteers);
router.post('/', createVolunteer);

module.exports = router;