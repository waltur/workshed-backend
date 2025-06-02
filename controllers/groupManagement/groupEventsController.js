
const pool = require('../../db');
// Crear evento
const createEvent = async (req, res) => {
  const { id_group, title, description, start, end } = req.body;

  if (!id_group || !title || !start) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
   await pool.query(`
     INSERT INTO group_management.group_events (id_group, title, description, start, "end", event_date)
     VALUES ($1, $2, $3, $4, $5, $6)
   `, [id_group, title, description, start, end, start]);

    res.status(201).json({ message: 'Event created successfully' });
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
};

// Listar eventos por grupo
const getEventsByGroup = async (req, res) => {
  const groupId = req.params.id;
  try {
    const result = await pool.query(`
      SELECT * FROM group_management.group_events WHERE id_group = $1 ORDER BY event_date DESC
    `, [groupId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
};

const getAllEvents = async (req, res) => {
  const { contactId } = req.query;
  console.log('Received id_contact:', contactId);

  const query = `
    SELECT
      e.id_event,
      e.title,
      e.description,
      e.start,
      e."end",
      g.name,
      CASE WHEN EXISTS (
        SELECT 1 FROM group_management.event_attendees a
        WHERE a.id_event = e.id_event AND a.id_contact = $1
      ) THEN 'Attendant' ELSE NULL END AS is_attending,
      CASE WHEN EXISTS (
        SELECT 1 FROM group_management.event_instructors i
        WHERE i.id_event = e.id_event AND i.id_contact = $1
      ) THEN 'Coordinator' ELSE NULL END AS is_instructor,
      CASE WHEN EXISTS (
        SELECT 1 FROM group_management.event_helpers h
        WHERE h.id_event = e.id_event AND h.id_contact = $1
      ) THEN 'General Support' ELSE NULL END AS is_support
    FROM group_management.group_events e
    LEFT JOIN group_management.groups g ON e.id_group = g.id_group
    ORDER BY e.start DESC
  `;

  try {
    const result = await pool.query(query, [contactId || null]);

    const events = result.rows.map(row => ({
      id_event: row.id_event,
      title: row.title,
      description: row.description,
      start: row.start,
      end: row.end,
      group_name: row.name,
      registration_roles: [
        row.is_attending,
        row.is_instructor,
        row.is_support
      ].filter(Boolean) // Elimina nulls
    }));

    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { createEvent, getEventsByGroup, getAllEvents };