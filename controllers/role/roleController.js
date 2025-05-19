const pool = require('../../db');

const getRoles = async (req, res) => {
  try {
    const result = await pool.query('SELECT id_role, role_name FROM auth.roles ORDER BY role_name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting roles:', err);
    res.status(500).json({ error: 'Failed to load roles' });
  }
};

module.exports = { getRoles };