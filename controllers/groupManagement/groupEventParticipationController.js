const pool = require('../../db');

// 📌 Registrar miembro como asistente
const registerAttendee = async (req, res) => {
  const { id_event, id_contact } = req.body;

  try {
    const existing = await pool.query(`
      SELECT 1 FROM group_management.event_attendees
      WHERE id_event = $1 AND id_contact = $2
    `, [id_event, id_contact]);

    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Already registered' });
    }

    await pool.query(`
      INSERT INTO group_management.event_attendees (id_event, id_contact)
      VALUES ($1, $2)
    `, [id_event, id_contact]);

    res.json({ message: 'Attendee registered' });
  } catch (err) {
    console.error('Error registering attendee:', err);
    res.status(500).json({ error: 'Failed to register attendee' });
  }
};

// 📌 Registrar voluntario como instructor
const registerInstructor = async (req, res) => {
  const { id_event, id_contact } = req.body;

  try {
    // Validar si el contacto tiene job_role "Class/Group leaders"
    const result = await pool.query(`
      SELECT 1
      FROM contacts.contact_job_role cjr
      JOIN contacts.job_roles jr ON cjr.id_job_role = jr.id_job_role
      WHERE cjr.id_contact = $1 AND LOWER(jr.title) = 'class/group leaders'
    `, [id_contact]);

    if (result.rowCount === 0) {
      return res.status(403).json({ error: 'Not authorized as instructor' });
    }

    await pool.query(`
      INSERT INTO group_management.event_instructors (id_event, id_contact)
      VALUES ($1, $2) ON CONFLICT DO NOTHING
    `, [id_event, id_contact]);

    res.json({ message: 'Instructor registered' });
  } catch (err) {
    console.error('Error registering instructor:', err);
    res.status(500).json({ error: 'Failed to register instructor' });
  }
};

const registerHelper = async (req, res) => {
  const { id_event, id_contact, helper_role, comments, assigned_by } = req.body;

  if (!id_event || !id_contact) {
    return res.status(400).json({ error: 'id_event and id_contact are required' });
  }

  try {
    // Verificar si ya está registrado como helper
    const existing = await pool.query(
      `SELECT 1 FROM group_management.event_helpers
       WHERE id_event = $1 AND id_contact = $2`,
      [id_event, id_contact]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Already registered as helper' });
    }

    // Insertar nuevo registro con campos opcionales
    await pool.query(
      `INSERT INTO group_management.event_helpers
        (id_event, id_contact, helper_role, comments, assigned_by, assigned_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [id_event, id_contact, helper_role || null, comments || null, assigned_by || null]
    );

    res.status(201).json({ message: 'Helper registered successfully' });
  } catch (err) {
    console.error('Error registering helper:', err);
    res.status(500).json({ error: 'Failed to register helper' });
  }
};


const getGroupRoles = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM group_management.group_roles ORDER BY name_role');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { registerAttendee, registerInstructor, registerHelper, getGroupRoles };