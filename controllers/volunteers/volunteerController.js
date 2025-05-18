const pool = require('../../db');

// Obtener todos los voluntarios
const getAllVolunteers = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM volunteers.volunteers');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve volunteers' });
  }
};

// Crear nuevo voluntario
const createVolunteer = async (req, res) => {
  const {
    id_contact,
    role,
    skills,
    availability,
    status,
    startDate,
    endDate,
    backgroundCheck,
    notes,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO volunteers.volunteers
      (id_contact, role, skills, availability, status, start_date, end_date, background_check, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [id_contact, role, skills, availability, status, startDate, endDate, backgroundCheck, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create volunteer' });
  }
};

module.exports = {
  getAllVolunteers,
  createVolunteer,
};