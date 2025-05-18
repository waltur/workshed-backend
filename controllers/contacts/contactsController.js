const pool = require('../../db');

// Crear nuevo contacto
const createContact = async (req, res) => {
  const { name, email, phone_number, type } = req.body;

  try {
    const result = await pool.query(
                     `INSERT INTO contacts.contacts ("name", "email", "phone_number", "type")
                      VALUES ($1, $2, $3, $4) RETURNING *`,
                     [name, email, phone_number, type]
                   );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating contact:', err);
    res.status(500).json({ error: 'Failed to create contact' });
  }
};

const getAllContacts = async (req, res) => {
  try {
    const result = await pool.query(  'SELECT * FROM contacts.contacts WHERE is_active = true ORDER BY id_contact DESC');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching contacts:', err);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
};

const updateContact = async (req, res) => {
  const id = req.params.id;
  const { name, email, phone_number, type } = req.body;
  try {
    const result = await pool.query(
      `UPDATE contacts.contacts
       SET name = $1, email = $2, phone_number = $3, type = $4
       WHERE id_contact = $5 RETURNING *`,
      [name, email, phone_number, type, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update contact' });
  }
};

const deleteContact = async (req, res) => {
  const id = req.params.id;
  try {
     await pool.query(
         'UPDATE contacts.contacts SET is_active = false WHERE id_contact = $1',
         [id]
       );
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete contact' });
  }
};
const reactivateContact = async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query(
      'UPDATE contacts.contacts SET is_active = true WHERE id_contact = $1',
      [id]
    );
    res.status(200).json({ message: 'Contact reactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reactivate contact' });
  }
};
const getContactById = async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(
      'SELECT * FROM contacts.contacts WHERE id_contact = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error getting contact by ID:', err);
    res.status(500).json({ error: 'Failed to get contact' });
  }
};

module.exports = { createContact,getAllContacts, updateContact, deleteContact,reactivateContact,getContactById };