
const pool = require('../../db');
// Crear evento
const createEvent = async (req, res) => {
console.log("create event");
  const {
    id_group,
    title,
    description,
    start,
    end,
    location,
    repeatType = '',
    repeatCount = 1,
  } = req.body;

  if (!id_group || !title || !start) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const events = [];

  // Obtener hora exacta sin desfase por zona horaria
  let startDate = new Date(start + ':00'); // Asegura formato completo con segundos
  let endDate = end ? new Date(end + ':00') : null;

  for (let i = 0; i < repeatCount; i++) {
    // Crear nuevas instancias para esta iteración
    const eventStart = new Date(startDate);
    const eventEnd = endDate ? new Date(endDate) : null;

    // Guardar como string en formato 'YYYY-MM-DD HH:mm:ss'
    const formattedStart = eventStart.toISOString().slice(0, 19).replace('T', ' ');
    //const formattedEnd = eventEnd ? eventEnd.toISOString().slice(0, 19).replace('T', ' ') : null;
    const eventDate = formattedStart.split(' ')[0];

    try {
      const result = await pool.query(
        `
        INSERT INTO group_management.group_events (id_group, title, description, start, "end", event_date, location)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
        `,
        [id_group, title, description, eventStart, eventEnd, eventDate, location]
      );
      events.push(result.rows[0]);
    } catch (err) {
      console.error('Error creating event:', err);
      return res.status(500).json({ error: 'Failed to create event(s)' });
    }

    // Avanzar la fecha para la próxima repetición
    if (repeatType === 'weekly') {
      startDate.setDate(startDate.getDate() + 7);
      if (endDate) endDate.setDate(endDate.getDate() + 7);
    } else if (repeatType === 'monthly') {
      startDate.setMonth(startDate.getMonth() + 1);
      if (endDate) endDate.setMonth(endDate.getMonth() + 1);
    }
  }

  return res.status(201).json(events.length === 1 ? events[0] : events);
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
      e.location,
      e.id_group,
      g.name,
      -- Verificar si el usuario está registrado como asistente, instructor o support
        (
            SELECT signature
            FROM group_management.event_signatures s
            WHERE s.id_event = e.id_event AND s.id_contact = $1
            LIMIT 1
          ) AS signature,
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
      ) THEN 'General Support' ELSE NULL END AS is_support,

      -- ✅ Confirmación de asistencia (nuevo campo)
      CASE WHEN EXISTS (
        SELECT 1 FROM group_management.event_attendees a
        WHERE a.id_event = e.id_event AND a.id_contact = $1 AND a.attended = true
      ) THEN true ELSE false END AS attended
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
      location: row.location,
      id_group: row.id_group,
      group_name: row.name,
      registration_roles: [
        row.is_attending,
        row.is_instructor,
        row.is_support
      ].filter(Boolean),
      attended: row.attended,
      signature: row.signature,
    }));

    // Obtener tareas asociadas
    const eventsWithTasks = await Promise.all(
      events.map(async (event) => {
        const taskQuery = `
          SELECT task_name, time_range, volunteer_needed
          FROM group_management.event_tasks
          WHERE id_event = $1
        `;
        const taskResult = await pool.query(taskQuery, [event.id_event]);
        return {
          ...event,
          tasks: taskResult.rows
        };
      })
    );

    res.json(eventsWithTasks);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteEvent = async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar si hay timesheets asociados
    const timesheets = await pool.query(
      `SELECT 1 FROM group_management.group_timesheets WHERE id_event = $1 LIMIT 1`,
      [id]
    );

    // Verificar si hay asistentes asociados
    const attendees = await pool.query(
      `SELECT 1 FROM group_management.event_attendees WHERE id_event = $1 LIMIT 1`,
      [id]
    );

    if (timesheets.rowCount > 0 || attendees.rowCount > 0) {
      return res.status(409).json({
        error: 'This event has related timesheets or attendees. Confirm deletion with cascade.'
      });
    }

    const result = await pool.query(
      `DELETE FROM group_management.group_events WHERE id_event = $1 RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event deleted successfully' });

  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
};

const deleteEventCascade = async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Eliminar asistentes del evento
    await client.query(
      `DELETE FROM group_management.event_attendees WHERE id_event = $1`,
      [id]
    );

    // Eliminar timesheets relacionados
    await client.query(
      `DELETE FROM group_management.group_timesheets WHERE id_event = $1`,
      [id]
    );

    // Eliminar tareas del evento
    await client.query(
      `DELETE FROM group_management.event_tasks WHERE id_event = $1`,
      [id]
    );

    // Finalmente eliminar el evento
    const result = await client.query(
      `DELETE FROM group_management.group_events WHERE id_event = $1 RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }

    await client.query('COMMIT');
    res.json({ message: 'Event and all related records deleted successfully' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting event cascade:', err);
    res.status(500).json({ error: 'Failed to delete event and related data' });
  } finally {
    client.release();
  }
};

const updateEvent = async (req, res) => {
  const { id } = req.params;
  const { title, description, start, end, id_group, location } = req.body;

  if (!title || !start) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      `
      UPDATE group_management.group_events
      SET title = $1,
          description = $2,
          start = $3,
          "end" = $4,
          id_group = $5,
          location = $6
      WHERE id_event = $7
      RETURNING *
      `,
      [title, description, start, end, id_group, location, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
};

const deleteTasksByEventId = async (req, res) => {
  const { id_event } = req.params;

  try {
    await pool.query('DELETE FROM group_management.event_tasks WHERE id_event = $1', [id_event]);
    res.status(200).json({ message: 'Tasks deleted successfully' });
  } catch (err) {
    console.error('Error deleting tasks:', err);
    res.status(500).json({ error: 'Failed to delete tasks' });
  }
};
// controllers/eventController.js
const getEventRegistrations = async (req, res) => {
  const { id_event } = req.params;
  try {
    const result = await pool.query(`
      SELECT c.id_contact, c.name, c.email, c.phone_number, ea.attended
      FROM group_management.event_attendees ea
      JOIN contacts.contacts c ON c.id_contact = ea.id_contact
      WHERE ea.id_event = $1
    `, [id_event]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching attendees:', error);
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
};
const updateAttendance = async (req, res) => {
  const { id_event, id_contact } = req.params;
  const { attended } = req.body;

  try {
    await pool.query(`
      UPDATE group_management.event_attendees
      SET attended = $1
      WHERE id_event = $2 AND id_contact = $3
    `, [attended, id_event, id_contact]);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error updating attendance:', err);
    res.status(500).json({ error: 'Failed to update attendance' });
  }
};
const saveSignature = async (req, res) => {
  const { id_event, id_contact, signature } = req.body;

  if (!id_event || !id_contact || !signature) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    await pool.query(
      `INSERT INTO group_management.event_signatures (id_event, id_contact, signature, signed_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (id_event, id_contact) DO UPDATE SET signature = $3, signed_at = NOW()`,
      [id_event, id_contact, signature]
    );

    res.status(200).json({ message: 'Signature saved' });
  } catch (err) {
    console.error('Error saving signature:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
module.exports = { createEvent, getEventsByGroup, getAllEvents, deleteEvent, updateEvent, deleteTasksByEventId, getEventRegistrations, updateAttendance,saveSignature,deleteEventCascade };