
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

      // avanzar recurrencia
      if (repeatType === 'weekly') {
        startDate.setDate(startDate.getDate() + 7);
        if (endDate) endDate.setDate(endDate.getDate() + 7);
      }

      if (repeatType === 'monthly') {
        startDate.setMonth(startDate.getMonth() + 1);
        if (endDate) endDate.setMonth(endDate.getMonth() + 1);
      }
    }

    // 🔥 SOCKET.IO
    const io = req.app.get('io');

    // ✅ emitir correctamente TODOS los eventos
     io.emit('eventsCreated', events);

    // ✅ responder
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
    scope = 'all', // 'from' | 'all'
    fromDate = null,
    title,
    description,
    start,
    end,
    id_group,
    location
  } = req.body;

  if (!series_id) {
    return res.status(400).json({ error: 'Missing series_id' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 🔥 Validar existencia
    const exists = await client.query(
      `SELECT 1 FROM group_management.group_events WHERE series_id = $1 LIMIT 1`,
      [series_id]
    );

    if (exists.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Series not found' });
    }

    // 🔥 Validar fechas
    if (start && end && new Date(end) < new Date(start)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'End date cannot be before start'
      });
    }

    let result;

    // 🔥 SHIFT (clave para recurrencia)
    if (scope === 'from') {
      if (!fromDate) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'fromDate is required for scope=from'
        });
      }

      result = await client.query(
        `
        UPDATE group_management.group_events
        SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          start = CASE
            WHEN $3 IS NOT NULL THEN start + ($3::timestamp - start)
            ELSE start
          END,
          "end" = CASE
            WHEN $4 IS NOT NULL THEN "end" + ($4::timestamp - "end")
            ELSE "end"
          END,
          id_group = COALESCE($5, id_group),
          location = COALESCE($6, location)
        WHERE series_id = $7
          AND start >= $8
        RETURNING *
        `,
        [title, description, start, end, id_group, location, series_id, fromDate]
      );
    }

    else if (scope === 'all') {
      result = await client.query(
        `
        UPDATE group_management.group_events
        SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          id_group = COALESCE($3, id_group),
          location = COALESCE($4, location)
        WHERE series_id = $5
        RETURNING *
        `,
        [title, description, id_group, location, series_id]
      );
    }

    await client.query('COMMIT');

    // 🚀 SOCKET.IO
    const io = req.app.get('io');

    io.emit('eventSeriesUpdated', {
      series_id,
      scope,
      fromDate
    });

    res.json({
      message: 'Series updated successfully',
      updated: result.rowCount,
      events: result.rows
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating event series:', err);

    res.status(500).json({
      error: 'Failed to update series'
    });
  } finally {
    client.release();
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

        -- Roles del usuario
        CASE WHEN a.id_contact IS NOT NULL THEN 'Attendant' END AS is_attending,
        CASE WHEN i.id_contact IS NOT NULL THEN 'Coordinator' END AS is_instructor,
        CASE WHEN h.id_contact IS NOT NULL THEN 'General Support' END AS is_support,

        COALESCE(a.attended, false) AS attended,

        -- 🔥 Coordinator real desde DB
        MAX(
          CASE
            WHEN gr.name_role = 'Coordinator' THEN c.name
          END
        ) AS coordinator_name,

        -- 🔥 Tasks
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

      -- tasks
      LEFT JOIN group_management.event_tasks t
        ON t.id_event = e.id_event

      -- miembros
      LEFT JOIN group_management.group_members gm
        ON gm.id_group = e.id_group

      -- roles (CORRECTO 🔥)
      LEFT JOIN group_management.group_roles gr
        ON gr.id_group_role = gm.id_group_role

      -- contactos
      LEFT JOIN contacts.contacts c
        ON c.id_contact = gm.id_contact

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
      coordinator: row.coordinator_name || 'N/A',

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
  const { cascade = false } = req.query; // 🔥 control desde frontend
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 🔥 Validar existencia + relaciones en UNA sola query
    const check = await client.query(
      `
      SELECT
        e.id_event,
        EXISTS (
          SELECT 1 FROM group_management.group_timesheets t
          WHERE t.id_event = e.id_event
        ) AS has_timesheets,
        EXISTS (
          SELECT 1 FROM group_management.event_attendees a
          WHERE a.id_event = e.id_event
        ) AS has_attendees
      FROM group_management.group_events e
      WHERE e.id_event = $1
      `,
      [id]
    );

    if (check.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }

    const { has_timesheets, has_attendees } = check.rows[0];

    // 🔥 Si hay relaciones y NO es cascade → bloquear
    if ((has_timesheets || has_attendees) && cascade !== 'true') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Event has related data',
        has_timesheets,
        has_attendees
      });
    }

    // 🔥 Cascade delete (orden correcto)
    if (cascade === 'true') {
      await client.query(
        `DELETE FROM group_management.group_timesheets WHERE id_event = $1`,
        [id]
      );

      await client.query(
        `DELETE FROM group_management.event_attendees WHERE id_event = $1`,
        [id]
      );
    }

    // 🔥 Eliminar evento
    const deleted = await client.query(
      `DELETE FROM group_management.group_events WHERE id_event = $1 RETURNING *`,
      [id]
    );

    await client.query('COMMIT');

    // 🚀 SOCKET.IO (REALTIME)
    const io = req.app.get('io');
    io.emit('eventDeleted', {
      id_event: id,
      series_id: deleted.rows[0].series_id
    });

    res.json({
      message: 'Event deleted successfully',
      event: deleted.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting event:', err);

    res.status(500).json({
      error: 'Failed to delete event'
    });
  } finally {
    client.release();
  }
};



const updateEvent = async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    start,
    end,
    id_group,
    location,
    scope = 'single', // 🔥 single | future | all
    series_id,
    fromDate
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 🔥 Validar existencia
    const existing = await client.query(
      `SELECT * FROM group_management.group_events WHERE id_event = $1`,
      [id]
    );

    if (existing.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }

    const current = existing.rows[0];

    // 🔥 Validación fechas
    if (start && end && new Date(end) < new Date(start)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'End date cannot be before start date'
      });
    }

    let updated;

    // 🔥 CASO 1: SOLO ESTE EVENTO
    if (scope === 'single') {
      updated = await client.query(
        `
        UPDATE group_management.group_events
        SET title = COALESCE($1, title),
            description = COALESCE($2, description),
            start = COALESCE($3, start),
            "end" = COALESCE($4, "end"),
            id_group = COALESCE($5, id_group),
            location = COALESCE($6, location)
        WHERE id_event = $7
        RETURNING *
        `,
        [title, description, start, end, id_group, location, id]
      );
    }

    // 🔥 CASO 2: ESTE Y FUTUROS
    else if (scope === 'future') {
      if (!series_id || !fromDate) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'series_id and fromDate required for future updates'
        });
      }

      updated = await client.query(
        `
        UPDATE group_management.group_events
        SET title = COALESCE($1, title),
            description = COALESCE($2, description),
            start = start + ($3::timestamp - start),
            "end" = "end" + ($4::timestamp - "end"),
            location = COALESCE($5, location)
        WHERE series_id = $6
          AND start >= $7
        RETURNING *
        `,
        [title, description, start, end, location, series_id, fromDate]
      );
    }

    // 🔥 CASO 3: TODOS LOS EVENTOS
    else if (scope === 'all') {
      if (!series_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'series_id required for full update'
        });
      }

      updated = await client.query(
        `
        UPDATE group_management.group_events
        SET title = COALESCE($1, title),
            description = COALESCE($2, description),
            location = COALESCE($3, location)
        WHERE series_id = $4
        RETURNING *
        `,
        [title, description, location, series_id]
      );
    }

    await client.query('COMMIT');

    // 🚀 SOCKET.IO (REALTIME)
    const io = req.app.get('io');

    io.emit('eventUpdated', {
      id_event: id,
      series_id: series_id || current.series_id,
      scope
    });

    res.json({
      message: 'Event(s) updated successfully',
      events: updated.rows
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating event:', err);

    res.status(500).json({
      error: 'Failed to update event'
    });
  } finally {
    client.release();
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
module.exports = { createEvent, getEventsByGroup, getAllEvents, deleteEvent, updateEvent,updateEventSeries, deleteTasksByEventId, getEventRegistrations, updateAttendance,saveSignature, getMyEventsCount };