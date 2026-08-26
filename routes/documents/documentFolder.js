const express = require('express');

const router = express.Router();


const verifyToken =
  require('../../middleware/verifyToken');


const {

  getAllFolders,
  createFolder,
  updateFolder,
  updateFolderStatus,
  deleteFolder

} =
  require(
    '../../controllers/documents/documentFolderController'
  );


// =====================================================
// GET ALL FOLDERS
// =====================================================

router.get(
  '/',
  verifyToken,
  getAllFolders
);


// =====================================================
// CREATE FOLDER
// =====================================================

router.post(
  '/',
  verifyToken,
  createFolder
);


// =====================================================
// UPDATE FOLDER
// =====================================================

router.put(
  '/:id',
  verifyToken,
  updateFolder
);


// =====================================================
// ACTIVATE / DEACTIVATE
// =====================================================

router.patch(
  '/:id/status',
  verifyToken,
  updateFolderStatus
);


// =====================================================
// DELETE
// =====================================================

router.delete(
  '/:id',
  verifyToken,
  deleteFolder
);


module.exports = router;