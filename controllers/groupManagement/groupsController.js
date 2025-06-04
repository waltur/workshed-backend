const pool = require('../../db');

// Listar todos los grupos
const getGroups = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM group_management.groups ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting groups:', err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
};

// Obtener un grupo por ID
const getGroupById = async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('SELECT * FROM group_management.groups WHERE id_group = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Group not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting group:', err);
    res.status(500).json({ error: 'Failed to get group' });
  }
};

// Crear un nuevo grupo
const createGroup = async (req, res) => {
  const { name, description, category, image  } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO group_management.groups (name, description, category, image )
      VALUES ($1, $2, $3,$4) RETURNING *`,
      [name, description, category, image ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating group:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
};

// Actualizar grupo
const updateGroup = async (req, res) => {
  const id = req.params.id;
  const { name, description, category, is_active,image } = req.body;
  try {
    await pool.query(`
      UPDATE group_management.groups
      SET name = $1, description = $2, category = $3, is_active = $4, image=$6
      WHERE id_group = $5`,
      [name, description, category, is_active, id, image]
    );
    res.json({ message: 'Group updated successfully' });
  } catch (err) {
    console.error('Error updating group:', err);
    res.status(500).json({ error: 'Failed to update group' });
  }
};

// Eliminar grupo
const deleteGroup = async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM group_management.groups WHERE id_group = $1', [id]);
    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    console.error('Error deleting group:', err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
};

// Obtener miembros de un grupo
const getGroupMembers = async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(`
      SELECT gm.id_group_member, gm.role_in_group, gm.join_date,
             c.id_contact, c.name, c.email
      FROM group_management.group_members gm
      JOIN contacts.contacts c ON gm.id_contact = c.id_contact
      WHERE gm.id_group = $1
      ORDER BY gm.join_date DESC
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching group members:', err);
    res.status(500).json({ error: 'Failed to get group members' });
  }
};

// Agregar un miembro al grupo
const addGroupMember = async (req, res) => {
  const id_group = req.params.id;
  const { id_contact, role_in_group } = req.body;

  try {
    const result = await pool.query(`
      INSERT INTO group_management.group_members (id_group, id_contact, role_in_group)
      VALUES ($1, $2, $3) RETURNING *`,
      [id_group, id_contact, role_in_group]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding group member:', err);
    res.status(500).json({ error: 'Failed to add group member' });
  }
};

// Eliminar un miembro del grupo
const removeGroupMember = async (req, res) => {
  const id_member = req.params.memberId;
  try {
    await pool.query(`
      DELETE FROM group_management.group_members WHERE id_group_member = $1
    `, [id_member]);
    res.json({ message: 'Group member removed' });
  } catch (err) {
    console.error('Error removing group member:', err);
    res.status(500).json({ error: 'Failed to remove group member' });
  }
};


module.exports = {
  getGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  addGroupMember,
  removeGroupMember

};