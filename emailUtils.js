const crypto = require('crypto');
const nodemailer = require('nodemailer');
const  pool  = require('./db'); // asegúrate de ajustar la ruta
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
const jwt = require('jsonwebtoken');

const sendVerificationEmail = async (userId, email) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

  await pool.query(`
    INSERT INTO auth.email_verifications (user_id, token, expires_at)
    VALUES ($1, $2, $3)
  `, [userId, token, expiresAt]);

  const verifyLink = `${frontendUrl}/login/verify-email/${token}`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    to: email,
    subject: 'Verify your email address',
    html: `
      <p>Welcome! Please verify your email by clicking the link below:</p>
      <p><a href="${verifyLink}">${verifyLink}</a></p>
      <p>This link will expire in 24 hours.</p>
    `
  });
};
function generateEmailToken(id_user) {
  return jwt.sign({ id_user }, process.env.EMAIL_SECRET, { expiresIn: '15m' });
}

function verifyEmailToken(token) {
  return jwt.verify(token, process.env.EMAIL_SECRET);
}

module.exports = { sendVerificationEmail,  generateEmailToken, verifyEmailToken };