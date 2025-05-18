const express = require('express');
const router = express.Router();
const { createContact, getAllContacts,updateContact,deleteContact,reactivateContact,getContactById } = require('../../controllers/contacts/contactsController');

// POST /api/contacts
router.get('/', getAllContacts);
router.post('/', createContact);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);
router.patch('/:id/reactivate', reactivateContact);
router.get('/:id', getContactById);

module.exports = router;