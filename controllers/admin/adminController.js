const pool = require('../../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const getUsersWithRoles = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id_user, u.username, u.email, u.is_active, u.is_verified,
        ARRAY_AGG(r.role_name) AS roles
      FROM auth.users u
      LEFT JOIN auth.user_roles ur ON u.id_user = ur.id_user
      LEFT JOIN auth.roles r ON ur.id_role = r.id_role
      GROUP BY u.id_user, u.username, u.email, u.is_verified
      ORDER BY u.id_user DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Error getting users:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
};

const deactivateUser = async (req, res) => {
console.log("deactivateUser");
  const userId = req.params.id;

  try {
    await pool.query(`UPDATE auth.users SET is_active = '0' WHERE id_user = $1`, [userId]);
    res.json({ message: 'User deactivated' });
  } catch (err) {
    console.error('Error deactivating user:', err);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
};
const activateUser = async (req, res) => {
  const userId = req.params.id;

  try {
    await pool.query(`UPDATE auth.users SET is_active = '1' WHERE id_user = $1`, [userId]);
    res.json({ message: 'User activated' });
  } catch (err) {
    console.error('Error activating user:', err);
    res.status(500).json({ error: 'Failed to activate user' });
  }
};
const notVerifiedMail = async (req, res) => {
console.log("deactivateUser");
  const userId = req.params.id;

  try {
    await pool.query(`UPDATE auth.users SET is_verified = '0' WHERE id_user = $1`, [userId]);
    res.json({ message: 'Not verified mail' });
  } catch (err) {
    console.error('Error not verified mail:', err);
    res.status(500).json({ error: 'Failed to not verified mail' });
  }
};
const verifiedMail = async (req, res) => {
  const userId = req.params.id;

  try {
    await pool.query(`UPDATE auth.users SET is_verified = '1' WHERE id_user = $1`, [userId]);
    res.json({ message: 'Verified mail' });
  } catch (err) {
    console.error('Error verified mail:', err);
    res.status(500).json({ error: 'Failed to verified mail' });
  }
};

const getUserById = async (req, res) => {
  const userId = req.params.id;

  try {
    // 1. Obtener datos del usuario con roles
    const userResult = await pool.query(`
      SELECT c.name, c.phone_number, c.emergency_contact,c.photo_url, u.id_user, u.username, u.email, u.is_verified ,u.is_active, u.id_contact,
        ARRAY_AGG(r.role_name) AS roles
      FROM auth.users u
      LEFT JOIN auth.user_roles ur ON u.id_user = ur.id_user
      LEFT JOIN auth.roles r ON ur.id_role = r.id_role
      LEFT JOIN contacts.contacts c ON c.id_contact = u.id_contact
      WHERE u.id_user = $1
      GROUP BY u.id_user, c.name, c.phone_number,c.emergency_contact,c.photo_url, u.is_verified
    `, [userId]);

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // 2. Obtener funciones voluntarias si tiene contacto
    let job_roles = [];
    if (user.id_contact) {
      const jobRolesResult = await pool.query(`
        SELECT id_job_role FROM contacts.contact_job_role WHERE id_contact = $1
      `, [user.id_contact]);

      job_roles = jobRolesResult.rows.map(r => r.id_job_role);
    }

    // 3. Devolver todo
    res.json({
      id_user: user.id_user,
      username: user.username,
      name: user.name,
      phone_number:user.phone_number,
      email: user.email,
      is_active: user.is_active,
      is_verified:user.is_verified,
      roles: user.roles,
      emergency_contact: user.emergency_contact,
      photo_url:user.photo_url,
      job_roles // ✅ devuelto como array de números
    });

  } catch (err) {
    console.error('Error getting user:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
};

const createUser = async (req, res) => {
  const { name, phone_number, username, email, password, roles = [], job_roles = [] } = req.body;

  try {
    // Validar email único
    const existing = await pool.query(`SELECT 1 FROM auth.users WHERE email = $1`, [email]);
    if (existing.rowCount > 0) return res.status(409).json({ error: 'Email is already in use' });


    // 🔐 Crear contacto mínimo para asociar job_roles
    const contactResult = await pool.query(`
      INSERT INTO contacts.contacts (name, email,phone_number, type)
      VALUES ($1, $2,$3, 'Person') RETURNING id_contact
    `, [name, email,phone_number]);

    const id_contact = contactResult.rows[0].id_contact;

    // 🔐 Crear usuario vinculado al contacto
    const hash = await bcrypt.hash(password, 10);
    const userResult = await pool.query(`
      INSERT INTO auth.users (username, email, password_hash, is_active, id_contact,is_verified)
      VALUES ($1, $2, $3, '1', $4,true) RETURNING id_user
    `, [username, email, hash, id_contact]);

    const userId = userResult.rows[0].id_user;

    // 🔐 Asignar roles
    for (const roleId of roles) {
      await pool.query(`INSERT INTO auth.user_roles (id_user, id_role) VALUES ($1, $2)`, [userId, roleId]);
    }

    // 🔐 Si tiene el rol de volunteer, asignar funciones (job_roles)
    const volunteerRoleIdResult = await pool.query(
      `SELECT id_role FROM auth.roles WHERE LOWER(role_name) = 'volunteer'`
    );
    const volunteerRoleId = volunteerRoleIdResult.rows[0]?.id_role;

    if (roles.includes(volunteerRoleId) && job_roles.length > 0) {
      for (const jobId of job_roles) {
        await pool.query(`
          INSERT INTO contacts.contact_job_role (id_contact, id_job_role)
          VALUES ($1, $2)
        `, [id_contact, jobId]);
      }
    }

    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

const updateUser = async (req, res) => {
  console.log("updateUser");
  const userId = req.params.id;
  const { name, phone_number, username, email, roles = [], job_roles = [] } = req.body;

  try {
    // 🔍 Verificar que el email no esté en uso por otro usuario
    const existing = await pool.query(
      `SELECT 1 FROM auth.users WHERE email = $1 AND id_user != $2`,
      [email, userId]
    );
    if (existing.rowCount > 0) {
      return res.status(409).json({ message: 'Email is already in use' });
    }

    // 🔄 Actualizar tabla auth.users
    await pool.query(`
      UPDATE auth.users SET username = $1, email = $2 WHERE id_user = $3
    `, [username, email, userId]);

    // 🔄 Reemplazar roles en auth.user_roles
    await pool.query(`DELETE FROM auth.user_roles WHERE id_user = $1`, [userId]);
    for (const roleId of roles) {
      await pool.query(`INSERT INTO auth.user_roles (id_user, id_role) VALUES ($1, $2)`, [userId, roleId]);
    }

    // 🔍 Obtener id_contact del usuario
    const userResult = await pool.query(`SELECT id_contact FROM auth.users WHERE id_user = $1`, [userId]);
    const id_contact = userResult.rows[0]?.id_contact;

    if (!id_contact) {
      return res.status(400).json({ message: 'User does not have a linked contact' });
    }

    // 🔄 Actualizar tabla contacts.contacts
    await pool.query(`
      UPDATE contacts.contacts
      SET name = $1, phone_number = $2, email = $3
      WHERE id_contact = $4
    `, [name, phone_number, email, id_contact]);

    // 🔍 Verificar si es volunteer
    const volunteerRoleIdResult = await pool.query(
      `SELECT id_role FROM auth.roles WHERE LOWER(role_name) = 'volunteer'`
    );
    const volunteerRoleId = volunteerRoleIdResult.rows[0]?.id_role;
    const isVolunteer = roles.includes(volunteerRoleId);

    // 🧹 Eliminar job_roles anteriores
    await pool.query(`DELETE FROM contacts.contact_job_role WHERE id_contact = $1`, [id_contact]);

    // ✅ Insertar job_roles si es volunteer
    if (isVolunteer && job_roles.length > 0) {
      for (const jobId of job_roles) {
        await pool.query(`
          INSERT INTO contacts.contact_job_role (id_contact, id_job_role)
          VALUES ($1, $2)
        `, [id_contact, jobId]);
      }
    }

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ message: 'Failed to update user' });
  }
};

module.exports = {
getUsersWithRoles,
deactivateUser,
notVerifiedMail,
verifiedMail,
activateUser,
getUserById,
createUser,
updateUser };