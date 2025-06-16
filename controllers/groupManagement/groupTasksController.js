const pool = require('../../db');

const createEventTask = async (req, res) => {
console.log("create event");
  const { id_event, task_name, time_range, volunteer_needed } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO group_management.event_tasks (id_event, task_name, time_range, volunteer_needed)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [id_event, task_name, time_range, volunteer_needed]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
};

const getTasksByEvent = async (req, res) => {
  const id_event = req.params.id_event;
  try {
    const result = await pool.query(`
      SELECT * FROM group_management.event_tasks
      WHERE id_event = $1
      ORDER BY id_task
    `, [id_event]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

module.exports = { createEventTask, getTasksByEvent };