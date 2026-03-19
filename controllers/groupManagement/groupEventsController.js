
const pool = require('../../db');
const { v4: uuidv4 } = require('uuid');
// Crear evento
const createEvent = async (req, res) => {
  const {
    id_group,
    title,
    description,
    start,
    end,
    location,
    repeatType = '',
    repeatCount = 1,
    series_id,
  } = req.body;

  if (!id_group || !title || !start) {
    return res.status(400).json({ error: 'Missing required fields' });
  }



  let startDate = new Date(start);
  let endDate = end ? new Date(end) : null;

  const events = [];

  try {
    for (let i = 0; i < repeatCount; i++) {
      const eventStart = new Date(startDate);
      const eventEnd = endDate ? new Date(endDate) : null;
      const eventDate = eventStart.toISOString().split('T')[0];

      const result = await pool.query(
        `
        INSERT INTO group_management.group_events
        (id_group, title, description, start, "end", event_date, location, series_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
        `,
        [
          id_group,
          title,
          description,
          eventStart,
          eventEnd,
          eventDate,
          location,
          series_id
        ]
      );

      events.push(result.rows[0]);

      // 👉 Avanzar fechas
      if (repeatType === 'weekly') {
        startDate.setDate(startDate.getDate() + 7);
        if (endDate) endDate.setDate(endDate.getDate() + 7);
      }

      if (repeatType === 'monthly') {
        startDate.setMonth(startDate.getMonth() + 1);
        if (endDate) endDate.setMonth(endDate.getMonth() + 1);
      }
    }

    res.status(201).json(events.length === 1 ? events[0] : events);

  } catch (error) {
    console.error('Error creating event(s):', error);
    res.status(500).json({ error: 'Failed to create event(s)' });
  }
};
// 🔁 Actualizar eventos recurrentes (single | from | all)
const updateEventSeries = async (req, res) => {
  const { series_id } = req.params;
  const {
    scope = 'all',       // 'single' | 'from' | 'all'
    fromDate = null,     // requerido solo para 'from'
    title,
    description,
    start,
    end,
    id_group,
    location
  } = req.body;

  if (!seriesId) {
    return res.status(400).json({ error: 'Missing seriesId' });
  }

  if (!title || !start) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let query = '';
  let values = [];

  try {
    // 🔹 SOLO ESTE EVENTO (seguridad extra, normalmente se usa updateEvent)
    if (scope === 'single') {
      return res.status(400).json({
        error: 'Use updateEvent endpoint for single event updates'
      });
    }

    // 🔹 TODOS LOS EVENTOS DE LA SERIE
    if (scope === 'all') {
      query = `
        UPDATE group_management.group_events
        SET title = $1,
            description = $2,
            start = $3,
            "end" = $4,
            id_group = $5,
            location = $6
        WHERE series_id = $7
        RETURNING *
      `;
      values = [
        title,
        description,
        start,
        end,
        id_group,
        location,
        series_id
      ];
    }

    // 🔹 ESTE Y LOS SIGUIENTES
    if (scope === 'from') {
      if (!fromDate) {
        return res.status(400).json({
          error: 'fromDate is required when scope is "from"'
        });
      }

      query = `
        UPDATE group_management.group_events
        SET title = $1,
            description = $2,
            start = $3,
            "end" = $4,
            id_group = $5,
            location = $6
        WHERE series_id = $7
          AND start >= $8
        RETURNING *
      `;
      values = [
        title,
        description,
        start,
        end,
        id_group,
        location,
        series_id,
        fromDate
      ];
    }

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No events updated' });
    }

    res.json({
      message: 'Event series updated successfully',
      updated: result.rowCount,
      events: result.rows
    });

  } catch (err) {
    console.error('Error updating event series:', err);
    res.status(500).json({ error: 'Failed to update event series' });
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
  try {
    const { contactId } = req.query;
    console.log('Received id_contact:', contactId);

    const query = `
      SELECT
        e.series_id,
        e.id_event,
        e.title,
        e.description,
        e.start,
        e."end",
        e.location,
        e.id_group,
        g.name,

        -- Firma
        s.signature,

        -- Roles
        CASE WHEN a.id_contact IS NOT NULL THEN 'Attendant' ELSE NULL END AS is_attending,
        CASE WHEN i.id_contact IS NOT NULL THEN 'Coordinator' ELSE NULL END AS is_instructor,
        CASE WHEN h.id_contact IS NOT NULL THEN 'General Support' ELSE NULL END AS is_support,

        COALESCE(a.attended, false) AS attended,

        -- 🔥 Tasks en una sola columna JSON
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'task_name', t.task_name,
              'time_range', t.time_range,
              'volunteer_needed', t.volunteer_needed
            )
          ) FILTER (WHERE t.id_event IS NOT NULL),
          '[]'
        ) AS tasks

      FROM group_management.group_events e

      LEFT JOIN group_management.groups g
        ON e.id_group = g.id_group

      LEFT JOIN group_management.event_signatures s
        ON s.id_event = e.id_event AND s.id_contact = $1

      LEFT JOIN group_management.event_attendees a
        ON a.id_event = e.id_event AND a.id_contact = $1

      LEFT JOIN group_management.event_instructors i
        ON i.id_event = e.id_event AND i.id_contact = $1

      LEFT JOIN group_management.event_helpers h
        ON h.id_event = e.id_event AND h.id_contact = $1

      -- 🔥 JOIN de tasks (clave)
      LEFT JOIN group_management.event_tasks t
        ON t.id_event = e.id_event

      GROUP BY
        e.series_id,
        e.id_event,
        e.title,
        e.description,
        e.start,
        e."end",
        e.location,
        e.id_group,
        g.name,
        s.signature,
        a.id_contact,
        a.attended,
        i.id_contact,
        h.id_contact

      ORDER BY e.start DESC
    `;

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
      series_id: row.series_id,

      registration_roles: [
        row.is_attending,
        row.is_instructor,
        row.is_support
      ].filter(Boolean),

      attended: row.attended,
      signature: row.signature,

      // 🔥 ya viene directo del SQL
      tasks: row.tasks
    }));

    return res.json(events);

  } catch (error) {
    console.error('Error fetching events:', error);
    return res.status(500).json({ error: 'Internal server error' });
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
const getMyEventsCount = async (req, res) => {
console.log("getMyEventsCount");
  const { contactId } = req.query;

  if (!contactId) {
    return res.status(400).json({ error: 'contactId is required' });
  }

  try {
    const result = await pool.query(`
      SELECT COUNT(DISTINCT e.id_event) AS total
      FROM group_management.group_events e
      LEFT JOIN group_management.event_attendees a
        ON a.id_event = e.id_event AND a.id_contact = $1
      LEFT JOIN group_management.event_instructors i
        ON i.id_event = e.id_event AND i.id_contact = $1
      LEFT JOIN group_management.event_helpers h
        ON h.id_event = e.id_event AND h.id_contact = $1
      WHERE a.id_contact IS NOT NULL
         OR i.id_contact IS NOT NULL
         OR h.id_contact IS NOT NULL
    `, [contactId]);

    res.json({ total: parseInt(result.rows[0].total) });

  } catch (error) {
    console.error('Error counting user events:', error);
    res.status(500).json({ error: 'Failed to count events' });
  }
};
module.exports = { createEvent, getEventsByGroup, getAllEvents, deleteEvent, updateEvent,updateEventSeries, deleteTasksByEventId, getEventRegistrations, updateAttendance,saveSignature,deleteEventCascade, getMyEventsCount };