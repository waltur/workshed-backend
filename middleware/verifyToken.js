const jwt = require('jsonwebtoken');
const pool = require('../db');

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;

const verifyToken = async (req, res, next) => {

  console.log('========== VERIFY TOKEN ==========');

  console.log('Authorization header:',
    req.headers.authorization
  );

  const authHeader =
    req.headers.authorization;

  if (!authHeader) {

    console.log(
      '❌ Authorization header missing'
    );

    return res.status(401).json({
      message: 'Access token required'
    });
  }

  if (!authHeader.startsWith('Bearer ')) {

    console.log(
      '❌ Authorization header malformed'
    );

    return res.status(401).json({
      message: 'Invalid authorization format'
    });
  }

  const token =
    authHeader.substring(7).trim();

  if (!token) {

    console.log(
      '❌ Empty access token'
    );

    return res.status(401).json({
      message: 'Access token required'
    });
  }

  try {

    const decoded =
      jwt.verify(
        token,
        ACCESS_TOKEN_SECRET
      );

    console.log(
      'JWT USER:',
      decoded
    );

    const result =
      await pool.query(
        `
        SELECT is_active
        FROM auth.users
        WHERE id_user = $1
        `,
        [decoded.id]
      );

    if (!result.rows.length) {

      console.log(
        '❌ User not found:',
        decoded.id
      );

      return res.status(401).json({
        message: 'User not found'
      });
    }

    console.log(
      'USER is_active:',
      result.rows[0].is_active
    );

    if (!result.rows[0].is_active) {

      console.log(
        '❌ User disabled'
      );

      return res.status(401).json({
        message: 'User disabled'
      });
    }

    console.log(
      '✅ Token valid'
    );

    req.user = decoded;

    next();

  } catch (err) {

    console.error(
      '❌ Token error:',
      err.message
    );

    return res.status(403).json({
      message: 'Invalid or expired token'
    });
  }
};

module.exports = verifyToken;