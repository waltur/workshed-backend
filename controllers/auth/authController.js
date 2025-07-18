const pool = require('../../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
// Secretos
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
const { sendVerificationEmail } = require('../../emailUtils');
const path = require('path');
const fs = require('fs');




const register = async (req, res) => {
console.log("register");
  const { name, phone_number, email, username, password, roles, job_roles = [], photoBase64, emergency_contact } = req.body;

let photoUrl = null;

  if (photoBase64) {
    try {
      const matches = photoBase64.match(/^data:(.+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: 'Invalid image format' });
      }

      const ext = matches[1].includes('png') ? '.png' : '.jpg';
      const buffer = Buffer.from(matches[2], 'base64');
      const filename = `photo_${uuidv4()}${ext}`;
      const uploadPath = path.join(__dirname, '../../public/uploads/photos');

      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      fs.writeFileSync(path.join(uploadPath, filename), buffer);
      photoUrl = `/public/uploads/photos/${filename}`;

    } catch (err) {
      console.error('Error saving image:', err);
      return res.status(500).json({ error: 'Failed to save photo' });
    }
  }

  try {
    // 1. Crear contacto
    const sanitizedEmergencyContact = emergency_contact === '' ? null : emergency_contact;
    const contactResult = await pool.query(
      `INSERT INTO contacts.contacts (name, email, phone_number, type, photo_url, emergency_contact)
       VALUES ($1, $2, $3, $4, $5, $6 ) RETURNING id_contact`,
      [name, email, phone_number, 'Person',photoUrl, sanitizedEmergencyContact]
    );
    const id_contact = contactResult.rows[0].id_contact;

    await pool.query(`
      INSERT INTO membership.membership_forms (
        id_contact, age_range, photo_permission, community_preference,
        wants_to_volunteer, acknowledged_rules, acknowledged_privacy,
        acknowledged_code_of_conduct, acknowledged_health_safety, volunteer_acknowledgement
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `, [
      id_contact,
      req.body.age_range,
      req.body.photo_permission,
      req.body.community_preference,
      req.body.wants_to_volunteer,
      req.body.acknowledged_rules,
      req.body.acknowledged_privacy,
      req.body.acknowledged_code_of_conduct,
      req.body.acknowledged_health_safety,
      req.body.volunteer_acknowledgement || null
    ]);
    // 2. Crear usuario
    const hash = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      `INSERT INTO auth.users (username, email, password_hash, id_contact, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING id_user`,
      [username, email, hash, id_contact,'1']
    );
    const userId = userResult.rows[0].id_user;
    await sendVerificationEmail(userId, email);

    // 3. Asignar roles
    for (const roleId of roles) {
      await pool.query(
        `INSERT INTO auth.user_roles (id_user, id_role) VALUES ($1, $2)`,
        [userId, roleId]
      );
    }
    const hasVolunteerRole = roles.some(roleId => {
      return pool.query(`SELECT role_name FROM auth.roles WHERE id_role = $1`, [roleId])
        .then(res => res.rows[0]?.name === 'volunteer');
    });

    if (hasVolunteerRole && job_roles.length > 0) {
      for (const jobId of job_roles) {
        await pool.query(
          `INSERT INTO contacts.contact_job_role (id_contact, id_job_role)
           VALUES ($1, $2)`,
          [id_contact, jobId]
        );
      }
    }

    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

const login = async (req, res) => {
  console.log("login");

  const { email, password } = req.body;

  try {
    const result = await pool.query(`SELECT * FROM auth.users WHERE email = $1`, [email]);
    const user = result.rows[0];

 if (!user) {
   return res.status(401).type('application/json').json({ message: 'Invalid credentials' });
 }
 if (!user.is_verified) {
     return res.status(403).json({ message: 'Please verify your email before logging in.' });
 }

 const match = await bcrypt.compare(password, user.password_hash);
 if (!match) {
   return res.status(401).type('application/json').json({ message: 'Invalid credentials' });
 }

    const userRoles = await getUserRoles(user.id_user); // e.g., ['admin']
    const jobRoles = await getUserJobRoles(user.id_user); // e.g., ['Leader']

    const accessToken = jwt.sign(
      {
        id: user.id_user,
        username: user.username,
        email: user.email,
        contact_id: user.id_contact,
        roles: userRoles,
        job_roles: jobRoles
      },
      ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user.id_user },
      REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    await pool.query(
      `INSERT INTO auth.refresh_tokens (user_id, token) VALUES ($1, $2)`,
      [user.id_user, refreshToken]
    );

    res.status(200).json({ accessToken, refreshToken });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed due to server error' });
  }
};

const refreshToken = async (req, res) => {
  const { token } = req.body;

  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const stored = await pool.query(
      `SELECT * FROM auth.refresh_tokens WHERE token = $1`,
      [token]
    );

    if (stored.rowCount === 0) return res.status(403).json({ error: 'Invalid token' });

    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET);

    const roles = await getUserRoles(payload.id);
    const newAccessToken = jwt.sign(
      { id: payload.id, username: payload.username, email: payload.email, roles },
      ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(403).json({ error: 'Invalid or expired refresh token' });
  }
};
const getUserRoles = async (userId) => {
  const result = await pool.query(`
    SELECT r.role_name
    FROM auth.user_roles ur
    JOIN auth.roles r ON ur.id_role = r.id_role
    WHERE ur.id_user = $1
  `, [userId]);

  return result.rows.map(row => row.role_name);
};
const getUserJobRoles = async (id_user) => {
  const result = await pool.query(`
    SELECT jr.title
    FROM contacts.contact_job_role cjr
    JOIN contacts.job_roles jr ON cjr.id_job_role = jr.id_job_role
    JOIN auth.users u ON u.id_contact = cjr.id_contact
    WHERE u.id_user = $1
  `, [id_user]);

  return result.rows.map(row => row.title);
};
const checkEmailExists = async (req, res) => {
  const { email } = req.query;
  try {
    const result = await pool.query('SELECT 1 FROM auth.users WHERE email = $1', [email]);
    const exists = result.rows.length > 0;
    res.json({ exists });
  } catch (err) {
    console.error('Check email error:', err);
    res.status(500).json({ error: 'Server error checking email' });
  }
};
const checkUsernameExists = async (req, res) => {
  const { username } = req.query;
  try {
    const result = await pool.query('SELECT 1 FROM auth.users WHERE username = $1', [username]);
    const exists = result.rows.length > 0;
    res.json({ exists });
  } catch (err) {
    console.error('Check username error:', err);
    res.status(500).json({ error: 'Server error checking username' });
  }
};

const changePassword = async (req, res) => {
  console.log("changePassword");
  const userId = req.user?.id; // Debes proteger esta ruta con middleware JWT
  const { currentPassword, newPassword } = req.body;

  try {
    const userResult = await pool.query(`SELECT password_hash FROM auth.users WHERE id_user = $1`, [userId]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ message: 'User not found' });

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE auth.users SET password_hash = $1 WHERE id_user = $2`, [newHash, userId]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password update error:', err);
    res.status(500).json({ message: 'Failed to update password' });
  }
};

const forgotPassword = async (req, res) => {
console.log("forgotPassword");
  const { email } = req.body;

  try {
    const result = await pool.query(`SELECT id_user FROM auth.users WHERE email = $1`, [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: 'No user found with this email' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await pool.query(`
      INSERT INTO auth.password_resets (user_id, token, expires_at)
      VALUES ($1, $2, $3)
    `, [user.id_user, token, expiresAt]);

    //const resetLink = `http://localhost:4200/login/reset-password?token=${token}`;
    //const resetLink = `${frontendUrl}/login/reset-password?token=${token}`;
    const resetLink = `${frontendUrl}/login/reset-password/${token}`;


    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // O usa variables de entorno
      }
    });

    await transporter.sendMail({
      to: email,
      subject: 'Reset your password',
      html: `<p>Click here to reset your password: <a href="${resetLink}">${resetLink}</a></p>`
    });

    res.json({ message: 'Password reset link sent to email' });
  } catch (err) {
    console.error('Error in forgotPassword:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const result = await pool.query(`
      SELECT * FROM auth.password_resets
      WHERE token = $1 AND used = FALSE AND expires_at > NOW()
    `, [token]);

    const resetRecord = result.rows[0];
    if (!resetRecord) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await pool.query(`
      UPDATE auth.users
      SET password_hash = $1
      WHERE id_user = $2
    `, [newHash, resetRecord.user_id]);

    await pool.query(`
      UPDATE auth.password_resets
      SET used = TRUE
      WHERE id = $1
    `, [resetRecord.id]);

    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Error in resetPassword:', err);
    res.status(500).json({ message: 'Server error during password reset' });
  }
};
const verifyEmail = async (req, res) => {
  const { token } = req.params;

  try {
    const result = await pool.query(`
      SELECT user_id FROM auth.email_verifications
      WHERE token = $1 AND expires_at > NOW() AND verified = false
    `, [token]);

    const verification = result.rows[0];

    if (!verification) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // 1. Marcar como verificado en email_verifications
    await pool.query(`
      UPDATE auth.email_verifications
      SET verified = true
      WHERE token = $1
    `, [token]);

    // 2. Marcar como verificado en auth.users
    await pool.query(`
      UPDATE auth.users
      SET is_verified = true
      WHERE id_user = $1
    `, [verification.user_id]);

    // 3. Devolver confirmación
    return res.status(200).json({ message: 'Email successfully verified. You can now log in.' });

  } catch (err) {
    console.error('Email verification error:', err);
    return res.status(500).json({ message: 'Server error during email verification' });
  }
};
const resendVerificationEmail = async (req, res) => {
  const { email } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];

    if (user.is_verified) {
      return res.status(400).json({ message: 'User is already verified' });
    }

    const token = generateEmailToken(user.id_user); // Usa tu función actual de generación de token
    await sendVerificationEmail(email, token);

    res.json({ message: 'Verification email resent' });
  } catch (err) {
    console.error('Error resending verification email:', err);
    res.status(500).json({ message: 'Error sending email' });
  }
};

module.exports = { register, login, checkEmailExists, checkUsernameExists,refreshToken, changePassword, forgotPassword, resetPassword, verifyEmail, resendVerificationEmail  };