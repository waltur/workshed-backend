const pool = require('../db');

const getWelcomeMessage = async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ message: 'Connected to PostgreSQL', time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection failed' });
  }
};

module.exports = { getWelcomeMessage };