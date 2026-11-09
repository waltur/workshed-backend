
const jwt = require('jsonwebtoken');
const pool = require('../db');

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;

const isAccountActive = value => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    return ['1', 'true', 't'].includes(
      value.trim().toLowerCase()
    );
  }

  return false;
};

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: 'Access token required'
    });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Invalid authorization format'
    });
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    return res.status(401).json({
      message: 'Access token required'
    });
  }

  if (!ACCESS_TOKEN_SECRET) {
    console.error('JWT_SECRET is not configured');

    return res.status(500).json({
      message: 'Authentication service configuration error'
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      ACCESS_TOKEN_SECRET
    );

    if (
      !decoded ||
      !Number.isInteger(Number(decoded.id)) ||
      Number(decoded.id) <= 0
    ) {
      return res.status(401).json({
        message: 'Invalid token payload'
      });
    }

    const result = await pool.query(
      `
      SELECT is_active
      FROM auth.users
      WHERE id_user = $1
      `,
      [Number(decoded.id)]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: 'User not found'
      });
    }

    if (!isAccountActive(result.rows[0].is_active)) {
      return res.status(401).json({
        message: 'User disabled'
      });
    }

    req.user = decoded;

    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Access token expired'
      });
    }

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid access token'
      });
    }

    console.error('Token verification error:', err);

    return res.status(500).json({
      message: 'Authentication error'
    });
  }
};

module.exports = verifyToken;

