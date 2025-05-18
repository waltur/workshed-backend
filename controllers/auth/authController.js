const pool = require('../../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');




const register = async (req, res) => {
  const { username, email, password } = req.body;
console.log("register");
  try {
    // Verifica si ya existe
    const existing = await pool.query('SELECT id_user FROM auth.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const hash = await bcrypt.hash(password, 10);

    const userResult = await pool.query(
      `INSERT INTO auth.users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id_user, username, email`,
      [username, email, hash]
    );

    const userId = userResult.rows[0].id_user;

    // Buscar ID del rol 'volunteer'
    const roleResult = await pool.query(`SELECT id_role FROM auth.roles WHERE role_name = 'volunteer'`);
    const roleId = roleResult.rows[0]?.id_role;

    if (roleId) {
      await pool.query(
        `INSERT INTO auth.user_roles (id_user, id_role) VALUES ($1, $2)`,
        [userId, roleId]
      );
    }

    res.status(201).json(userResult.rows[0]);
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

module.exports = { register, login };