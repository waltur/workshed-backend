const express = require('express');
const router = express.Router();
const { register, login, checkEmailExists, checkUsernameExists,refreshToken,changePassword, forgotPassword, resetPassword, verifyEmail, resendVerificationEmail } = require('../../controllers/auth/authController');
const verifyToken = require('../../middleware/verifyToken');

router.post('/register', register);
router.post('/login', login);
router.get('/check-email', checkEmailExists);
router.get('/check-username', checkUsernameExists);
router.post('/refresh-token', refreshToken);
router.put('/change-password', verifyToken, changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);

module.exports = router;