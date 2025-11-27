const crypto = require('crypto');
//const nodemailer = require('nodemailer');
const  pool  = require('./db'); // asegúrate de ajustar la ruta
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
const jwt = require('jsonwebtoken');
const { MailerSend, EmailParams, Sender, Recipient } = require("mailersend");

const mailerSend = new MailerSend({
  apiKey: process.env.MAILERSEND_API_KEY,
});

async function sendVerificationEmail(userId, email) {
  try {
    // 1. Generar token de verificación
    const crypto = require("crypto");
    const pool = require("./db"); // Ajusta ruta si es necesario

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    await pool.query(
      `
      INSERT INTO auth.email_verifications (user_id, token, expires_at)
      VALUES ($1, $2, $3)
      `,
      [userId, token, expiresAt]
    );

    // 2. Crear link de verificación
    const verifyLink = `${frontendUrl}/login/verify-email/${token}`;

    // 3. Configurar MailerSend
    const sentFrom = new Sender(
      "info@theworkshed.org.au",
      "The Workshed Inner West Inc"
    );

    const recipients = [new Recipient(email)];

    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject("Verify your email")
      .setHtml(`
        <h2>Welcome to The Workshed Inner West Inc!</h2>
        <p>Please verify your email to activate your account.</p>

        <p>
          <a href="${verifyLink}"
             style="padding: 10px 20px; background: #0077cc; color: white; text-decoration: none; border-radius: 4px;">
            Verify Email
          </a>
        </p>

        <p>If the button doesn't work, copy and paste this link:</p>
        <p>${verifyLink}</p>

        <br>
        <p>This link will expire in 24 hours.</p>
      `);

    await mailerSend.email.send(emailParams);

    console.log(`Verification email sent to ${email}`);
  } catch (err) {
    console.error("Error sending verification email:", err);
    throw err;
  }
}
function generateEmailToken(id_user) {
  return jwt.sign({ id_user }, process.env.EMAIL_SECRET, { expiresIn: '15m' });
}

function verifyEmailToken(token) {
  return jwt.verify(token, process.env.EMAIL_SECRET);
}

/**
 * REENVÍA EMAIL DE VERIFICACIÓN SI EL USUARIO NO ESTÁ VERIFICADO
 */
async function resendVerificationEmail(userId, email) {
  try {
    // Eliminar tokens previos del usuario
    await pool.query(
      `DELETE FROM auth.email_verifications WHERE user_id = $1`,
      [userId]
    );

    // Reusar la función principal
    await sendVerificationEmail(userId, email);

    return true;
  } catch (err) {
    console.error("Error resending verification email:", err);
    throw err;
  }
}

module.exports = { sendVerificationEmail,  generateEmailToken, verifyEmailToken, resendVerificationEmail };