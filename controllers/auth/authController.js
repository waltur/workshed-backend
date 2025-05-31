const pool = require('../../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
// Secretos
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;




const register = async (req, res) => {
  const { name, phone_number, email, username, password, roles, job_roles = [] } = req.body;

  try {
    // 1. Crear contacto
    const contactResult = await pool.query(
      `INSERT INTO contacts.contacts (name, email, phone_number, type)
       VALUES ($1, $2, $3, $4) RETURNING id_contact`,
      [name, email, phone_number, 'Person']
    );
    const id_contact = contactResult.rows[0].id_contact;

    // 2. Crear usuario
    const hash = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      `INSERT INTO auth.users (username, email, password_hash, id_contact, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING id_user`,
      [username, email, hash, id_contact,'1']
    );
    const userId = userResult.rows[0].id_user;

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

// Login
const login = async (req, res) => {
console.log("login");
  const { email, password } = req.body;

  try {
    const result = await pool.query(`SELECT * FROM auth.users WHERE email = $1`, [email]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const userRoles = await getUserRoles(user.id_user); // devuelve ['admin'] o ['volunteer']
    const jobRoles = await getUserJobRoles(user.id_user);

    const accessToken = jwt.sign(
      { id: user.id_user, username: user.username, email: user.email,contact_id: user.id_contact, roles: userRoles, job_roles: jobRoles },
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

    res.json({ accessToken, refreshToken });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
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





module.exports = { register, login, checkEmailExists, checkUsernameExists,refreshToken };