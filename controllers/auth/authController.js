const pool = require('../../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');




const register = async (req, res) => {
  const { name, phone_number, email, username, password, roles } = req.body;

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
      `INSERT INTO auth.users (username, email, password_hash, id_contact)
       VALUES ($1, $2, $3, $4) RETURNING id_user`,
      [username, email, hash, id_contact]
    );
    const userId = userResult.rows[0].id_user;

    // 3. Asignar roles
    for (const roleId of roles) {
      await pool.query(
        `INSERT INTO auth.user_roles (id_user, id_role) VALUES ($1, $2)`,
        [userId, roleId]
      );
    }

    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

const login = async (req, res) => {
console.info("login");
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM auth.users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' }); // ✅
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' }); // ✅
    }

    const rolesResult = await pool.query(
      `SELECT r.role_name FROM auth.roles r
       JOIN auth.user_roles ur ON ur.id_role = r.id_role
       WHERE ur.id_user = $1`,
      [user.id_user]
    );

    const roles = rolesResult.rows.map(r => r.role_name);

    const token = jwt.sign(
      {
        userId: user.id_user,
        username: user.username,
        email: user.email,
        roles
      },
      'your_jwt_secret',
      { expiresIn: '1h' }
    );

    return res.json({ token }); // ✅ importante usar `return`
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
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

module.exports = { register, login, checkEmailExists, checkUsernameExists };