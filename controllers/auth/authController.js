const pool = require('../../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { MailerSend, EmailParams, Sender, Recipient } = require("mailersend");
//const nodemailer = require('nodemailer');
// Secretos
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
const { sendVerificationEmail } = require('../../emailUtils');
const path = require('path');
const fs = require('fs');




const register = async (req, res) => {

  const {
    first_name,
    last_name,
    phone_number,
    email,
    username,
    password,
    roles,
    job_roles = [],
    emergency_contact,
    photo_url,

    paypal_order_id,
    paypal_capture_id,



  } = req.body;

  const client = await pool.connect();

  try {
    const MEMBERSHIP_AMOUNT =
    Number(process.env.MEMBERSHIP_AMOUNT || 1);
    await client.query('BEGIN');

    const payment_required =
        !!paypal_order_id &&
        !!paypal_capture_id;
    //===================================================
    // VALIDAR PAGO PAYPAL SI ES NECESARIO
    //===================================================

    console.log("========== PAYMENT DATA ==========");
    console.log({
      payment_required,
      MEMBERSHIP_AMOUNT,
      paypal_order_id,
      paypal_capture_id
    });
    console.log("==================================");
    if (payment_required) {

      if (!paypal_order_id || !paypal_capture_id) {
        throw new Error('Membership payment is required.');
      }

      const existingPayment = await client.query(
        `
        SELECT *
        FROM membership.payments
        WHERE paypal_capture_id=$1
        `,
        [paypal_capture_id]
      );

      if (existingPayment.rows.length > 0) {
        throw new Error('This PayPal payment has already been used.');
      }

    }

    //--------------------------------------------------
    // CONTACT
    //--------------------------------------------------

    const sanitizedEmergencyContact =
      emergency_contact === '' ? null : emergency_contact;

    const contactResult = await client.query(
      `
      INSERT INTO contacts.contacts
      (
       gi first_name,
        last_name,
        email,
        phone_number,
        type,
        photo_url,
        emergency_contact
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id_contact
      `,
      [
        first_name,
        last_name,
        email,
        phone_number,
        'Person',
        photo_url || null,
        sanitizedEmergencyContact
      ]
    );

    const id_contact = contactResult.rows[0].id_contact;


    //--------------------------------------------------
    // MEMBERSHIP FORM
    //--------------------------------------------------

    await client.query(
      `
      INSERT INTO membership.membership_forms
      (
        id_contact,
        age_range,
        photo_permission,
        community_preference,
        wants_to_volunteer,
        acknowledged_rules,
        acknowledged_privacy,
        acknowledged_code_of_conduct,
        acknowledged_health_safety,
        volunteer_acknowledgement,
        volunteer_agreement
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `,
      [
        id_contact,
        req.body.age_range,
        req.body.photo_permission,
        req.body.community_preference,
        req.body.wants_to_volunteer,
        req.body.accept_membership_policy,
        req.body.accept_privacy_full,
        req.body.accept_code_full,
        req.body.accept_health_full ,
        req.body.volunteer_acknowledgement || null,
        req.body.volunteer_agreement,
      ]
    );

    //--------------------------------------------------
    // USER
    //--------------------------------------------------

    const hash = await bcrypt.hash(password, 10);

    const userResult = await client.query(
      `
      INSERT INTO auth.users
      (
        username,
        email,
        password_hash,
        id_contact,
        is_active
      )
      VALUES
      ($1,$2,$3,$4,$5)
      RETURNING id_user
      `,
      [
        username,
        email,
        hash,
        id_contact,
        1
      ]
    );

    const userId = userResult.rows[0].id_user;

    //--------------------------------------------------
    // ROLES
    //--------------------------------------------------

    for (const roleId of roles) {

      await client.query(
        `
        INSERT INTO auth.user_roles
        (id_user,id_role)
        VALUES($1,$2)
        `,
        [userId, roleId]
      );

    }

    //--------------------------------------------------
    // VOLUNTEER FUNCTIONS
    //--------------------------------------------------

    const volunteerRoleResult = await client.query(
      `
      SELECT id_role
      FROM auth.roles
      WHERE LOWER(role_name)='volunteer'
      `
    );

    const volunteerRoleId =
      volunteerRoleResult.rows[0]?.id_role;

    const hasVolunteerRole =
      volunteerRoleId
        ? roles.includes(volunteerRoleId)
        : false;

    if (hasVolunteerRole && job_roles.length > 0) {

      for (const jobId of job_roles) {

        await client.query(
          `
          INSERT INTO contacts.contact_job_role
          (
            id_contact,
            id_job_role
          )
          VALUES($1,$2)
          `,
          [id_contact, jobId]
        );

      }

    }
        //--------------------------------------------------
        //VOUNTEER PROFILE
        //--------------------------------------------------
        if (hasVolunteerRole){
        await client.query(
        `
        INSERT INTO volunteers.volunteer_profiles
        (
            id_contact,
            occupation,
            organisation,
            languages,
            own_vehicle,
            medical_conditions,
            volunteer_experience,
            emergency_notes,
            additional_information
        )
        VALUES
        (
            $1,$2,$3,$4,$5,$6,$7,$8,$9
        )
        `,
        [
            id_contact,
            req.body.occupation,
            req.body.organisation,
            req.body.languages,
            req.body.own_vehicle,
            req.body.medical_conditions,
            req.body.volunteer_experience,
            req.body.emergency_notes,
            req.body.additional_information
        ]
        );
       }
       //interests
    if (req.body.interests?.length) {

        for (const interestId of req.body.interests) {

            await client.query(
            `
            INSERT INTO volunteers.contact_interests
            (
                id_contact,
                id_interest
            )
            VALUES ($1,$2)
            `,
            [
                id_contact,
                interestId
            ]);

        }

    }
    //skill
    if (req.body.skills?.length) {

        for (const skillId of req.body.skills) {

            await client.query(
            `
            INSERT INTO volunteers.contact_skills
            (
                id_contact,
                id_skill
            )
            VALUES ($1,$2)
            `,
            [
                id_contact,
                skillId
            ]);

        }

    }
    //certification
    if (req.body.certifications?.length) {

        for (const certificationId of req.body.certifications) {

            await client.query(
            `
            INSERT INTO volunteers.contact_certifications
            (
                id_contact,
                id_certification
            )
            VALUES ($1,$2)
            `,
            [
                id_contact,
                certificationId
            ]);

        }

    }
    //hability
    if (req.body.availability?.length) {

        for (const availabilityId of req.body.availability) {

            await client.query(
            `
            INSERT INTO volunteers.contact_availability
            (
                id_contact,
                id_availability
            )
            VALUES ($1,$2)
            `,
            [
                id_contact,
                availabilityId
            ]);

        }

    }
    //--------------------------------------------------
    // SAVE PAYMENT
    //--------------------------------------------------
    let id_payment = null;
    if (payment_required) {

     const paymentResult = await client.query(
     `
     INSERT INTO membership.payments
     (
         id_contact,
         amount,
         currency,
         payment_status,
         paypal_order_id,
         paypal_capture_id,
         paid_at,
         membership_year,
         payment_method
     )
     VALUES
     (
         $1,
         $2,
         'AUD',
         'completed',
         $3,
         $4,
         NOW(),
         EXTRACT(YEAR FROM NOW()),
         'paypal'
     )
     RETURNING id_payment
     `,
     [
         id_contact,
         MEMBERSHIP_AMOUNT,
         paypal_order_id,
         paypal_capture_id
     ]
     );

      id_payment = paymentResult.rows[0].id_payment;

         //--------------------------------------------------
          // CREATE MEMBERSHIP
          //--------------------------------------------------

          const startDate = new Date();

          const endDate = new Date(startDate);

          endDate.setFullYear(
              endDate.getFullYear() + 1
          );

          await client.query(
          `
          INSERT INTO membership.memberships
          (
              id_contact,
              id_payment,
              membership_type,
              start_date,
              end_date,
              status
          )
          VALUES
          (
              $1,
              $2,
              'Annual',
              $3,
              $4,
              'active'
          )
          `,
          [
              id_contact,
              id_payment,
              startDate,
              endDate
          ]
          );
          //--------------------------------------------------

    }


    await client.query('COMMIT');

    try {

      await sendVerificationEmail(userId, email);

    } catch (err) {

      console.error(err);

    }

    res.status(201).json({
      message: 'User created successfully'
    });

  }
  catch (err) {

    await client.query('ROLLBACK');

    console.error(err);

    res.status(500).json({
      error: err.message
    });

  }
  finally {

    client.release();

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
 if (user.is_active !== '1') {
   return res.status(403).json({
     message: 'Account disabled. Contact administrator.'
   });
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
      { expiresIn: '60m' }
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

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    // 1️⃣ Verificar refresh token
    const stored = await pool.query(
      `SELECT * FROM auth.refresh_tokens WHERE token = $1`,
      [token]
    );

    if (stored.rowCount === 0) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET);

    // 2️⃣ Volver a cargar datos reales del usuario
    const userResult = await pool.query(
      `SELECT id_user, username, email, id_contact
       FROM auth.users
       WHERE id_user = $1`,
      [payload.id]
    );

    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 3️⃣ Roles completos
    const roles = await getUserRoles(user.id_user);
    const jobRoles = await getUserJobRoles(user.id_user);

    // 4️⃣ Nuevo access token COMPLETO
    const newAccessToken = jwt.sign(
      {
        id: user.id_user,
        username: user.username,
        email: user.email,
        contact_id: user.id_contact,
        roles,
        job_roles: jobRoles
      },
      ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    return res.json({ accessToken: newAccessToken });

  } catch (err) {
    console.error('Refresh token error:', err);
    return res.status(403).json({ error: 'Invalid or expired refresh token' });
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
    const result = await pool.query(
      `SELECT id_user FROM auth.users WHERE email = $1`,
      [email]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: "No user found with this email" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await pool.query(
      `
      INSERT INTO auth.password_resets (user_id, token, expires_at)
      VALUES ($1, $2, $3)
    `,
      [user.id_user, token, expiresAt]
    );

    const resetLink = `${frontendUrl}/login/reset-password/${token}`;

    // -------------------------------
    //  MAILERSEND CONFIG
    // -------------------------------
    const mailerSend = new MailerSend({
      apiKey: process.env.MAILERSEND_API_KEY,
    });

    const sentFrom = new Sender(
      "info@theworkshed.org.au",
      "The Workshed Inner West Inc"
    );

    const recipients = [new Recipient(email)];

    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject("Reset your password")
      .setHtml(`
        <p>Hello,</p>
        <p>You requested a password reset.</p>
        <p>Click the link below to reset your password:</p>

        <p><a href="${resetLink}" style="color:blue">${resetLink}</a></p>

        <br><br>
        <p>If you didn't request this, simply ignore this email.</p>
      `);

    await mailerSend.email.send(emailParams);

    return res.json({ message: "Password reset link sent to email" });
  } catch (err) {
    console.error("Error in forgotPassword:", err);
    return res.status(500).json({ message: "Internal server error" });
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
const resendVerificationEmailController = async (req, res) => {
  const { email } = req.body;

  try {
    const result = await pool.query(
      `SELECT id_user, is_verified FROM auth.users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    if (user.is_verified) {
      return res.status(400).json({ message: "User is already verified" });
    }

    await resendVerificationEmail(user.id_user, email);

    res.json({ message: "Verification email resent successfully" });
  } catch (err) {
    console.error("Error resending verification email:", err);
    res.status(500).json({ message: "Error resending verification email" });
  }
};

module.exports = { register, login, checkEmailExists, checkUsernameExists,refreshToken, changePassword, forgotPassword, resetPassword, verifyEmail, resendVerificationEmail:resendVerificationEmailController  };