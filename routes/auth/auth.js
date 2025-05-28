const express = require('express');
const router = express.Router();
const { register, login, checkEmailExists, checkUsernameExists,refreshToken } = require('../../controllers/auth/authController');

router.post('/register', register);
router.post('/login', login);
router.get('/check-email', checkEmailExists);
router.get('/check-username', checkUsernameExists);
router.post('/refresh-token', refreshToken);

module.exports = router;