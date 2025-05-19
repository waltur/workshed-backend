const express = require('express');
const router = express.Router();
const { register, login, checkEmailExists, checkUsernameExists } = require('../../controllers/auth/authController');

router.post('/register', register);
router.post('/login', login);
router.get('/check-email', checkEmailExists);
router.get('/check-username', checkUsernameExists);

module.exports = router;