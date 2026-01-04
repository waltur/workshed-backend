const express = require('express');
const router = express.Router();
const { uploadProfilePhoto } = require('../../controllers/uploadImages/uploadController');

router.post('/profile-photo', uploadProfilePhoto);

module.exports = router;