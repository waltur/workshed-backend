const jwt = require('jsonwebtoken');
const pool = require('../db'); // 👈 importa tu pool postgres

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;

const verifyToken = async (req, res, next) => {
  console.log("verifyToken");

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    // ✅ 1. verificar firma
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);

    // ✅ 2. consultar estado REAL del usuario en DB
    const result = await pool.query(
      'SELECT is_active FROM auth.users WHERE id_user = $1',
      [decoded.id]
    );

    if (!result.rows.length) {
      return res.status(401).json({ message: 'User not found' });
    }

    // 🔥 CLAVE: comparar string
    if (result.rows[0].is_active !== '1') {
      return res.status(401).json({ message: 'User disabled' });
    }

    // ✅ 3. permitir acceso
    req.user = decoded;
    next();

  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

module.exports = verifyToken;

module.exports = verifyToken;