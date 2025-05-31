const pool = require('../../db');

// Registrar timesheet
const createTimesheet = async (req, res) => {
  const { id_event, id_contact, hours, activity } = req.body;

  try {
    const result = await pool.query(`
      INSERT INTO group_management.group_timesheets (id_event, id_contact, hours, activity)
      VALUES ($1, $2, $3, $4) RETURNING *`,
      [id_event, id_contact, hours, activity]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating timesheet:', err);
    res.status(500).json({ error: 'Failed to create timesheet' });
  }
};

// Listar por evento
const getTimesheetsByEvent = async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(`
      SELECT ts.*, c.name, e.title AS event_title
      FROM group_management.group_timesheets ts
      JOIN contacts.contacts c ON ts.id_contact = c.id_contact
      JOIN group_management.group_events e ON ts.id_event = e.id_event
      WHERE ts.id_event = $1
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching timesheets:', err);
    res.status(500).json({ error: 'Failed to get timesheets' });
  }
};

module.exports = {createTimesheet,getTimesheetsByEvent}