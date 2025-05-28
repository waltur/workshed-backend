const express = require('express');
const router = express.Router();
const { getUsersWithRoles,deactivateUser, activateUser, getUserById, createUser, updateUser } = require('../../controllers/admin/adminController');

router.get('/users', getUsersWithRoles);
router.patch('/users/:id/deactivate', deactivateUser);
router.patch('/users/:id/activate', activateUser);
router.get('/users/:id', getUserById);
router.post('/users', createUser);
router.put('/users/:id', updateUser);

module.exports = router;