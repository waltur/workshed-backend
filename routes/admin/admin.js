/*const express = require('express');
const router = express.Router();
const verifyToken = require('../../middleware/verifyToken');
const authorize = require('../../middleware/authorize');
const { getUsersWithRoles,deactivateUser, activateUser, notVerifiedMail, verifiedMail, getUserById, createUser, updateUser } = require('../../controllers/admin/adminController');

//router.get('/users', getUsersWithRoles);
router.get( '/users',  verifyToken,  authorize('Committee'),  getUsersWithRoles);
router.patch('/users/:id/deactivate', deactivateUser);

router.patch('/users/:id/activate', activateUser);
router.patch('/users/:id/notVerifiedMail', notVerifiedMail);
router.patch('/users/:id/verifiedMail', verifiedMail);
router.get('/users/:id', getUserById);
router.post('/users', createUser);
router.put('/users/:id', updateUser);

module.exports = router;
*/
const express = require('express');
const router = express.Router();

const {
  getUsersWithRoles,
  deactivateUser,
  activateUser,
  notVerifiedMail,
  verifiedMail,
  getUserById,
  createUser,
  updateUser
} = require('../../controllers/admin/adminController_secure');

const verifyToken = require('../../middleware/verifyToken');
const authorize = require('../../middleware/authorize');


// ============================================
// USER ADMINISTRATION
// ============================================

router.get(
  '/users',
  verifyToken,
  authorize('Committee'),
  getUsersWithRoles
);


router.patch(
  '/users/:id/deactivate',
  verifyToken,
  authorize('Committee'),
  deactivateUser
);


router.patch(
  '/users/:id/activate',
  verifyToken,
  authorize('Committee'),
  activateUser
);


router.patch(
  '/users/:id/notVerifiedMail',
  verifyToken,
  authorize('Committee'),
  notVerifiedMail
);


router.patch(
  '/users/:id/verifiedMail',
  verifyToken,
  authorize('Committee'),
  verifiedMail
);


router.get(
  '/users/:id',
  verifyToken,
  authorize('Committee'),
  getUserById
);


router.post(
  '/users',
  verifyToken,
  authorize('Committee'),
  createUser
);


router.put(
  '/users/:id',
  verifyToken,
  authorize('Committee'),
  updateUser
);


module.exports = router;