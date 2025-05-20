const pool = require('../../db');

const getJobRoles = async (req, res) => {
  try {
    const result = await pool.query('SELECT id_job_role, title FROM contacts.job_roles ORDER BY title');
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting job roles:', err);
    res.status(500).json({ error: 'Failed to load job roles' });
  }
};

module.exports = { getJobRoles };