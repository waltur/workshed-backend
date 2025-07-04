const express = require('express');
const router = express.Router();
const { createContact, getAllContacts,updateContact,deleteContact,reactivateContact,getContactById, getContactJobRoles } = require('../../controllers/contacts/contactsController');

// POST /api/contacts
router.get('/', getAllContacts);
router.post('/', createContact);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);
router.patch('/:id/reactivate', reactivateContact);
router.get('/:id', getContactById);
router.get('/job-roles/:id_contact', getContactJobRoles);

module.exports = router;