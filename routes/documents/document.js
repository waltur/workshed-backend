const express = require('express');
const router = express.Router();
const verifyToken =  require('../../middleware/verifyToken');
//const uploadDocument =  require('../../middleware/uploadDocument');

const {
  getMyDocuments,
  acceptDocument,
  getAllDocuments,
  uploadDocument: uploadDocumentAdmin,
  updateDocument,
  updateDocumentStatus
} =
  require('../../controllers/documents/documentController');



// =====================================================
// GET MY DOCUMENTS
// =====================================================

router.get(
  '/my',
  verifyToken,
  getMyDocuments
);


// =====================================================
// ACCEPT DOCUMENT
// =====================================================

router.post(
  '/:id/accept',
  verifyToken,
  acceptDocument
);

// =====================================================
// ADMIN
// =====================================================

router.get(
  '/admin',
  verifyToken,
  getAllDocuments
);

router.post(
  '/admin/upload',
  verifyToken,
  uploadDocumentAdmin
);

router.put(
  '/admin/:id',
  verifyToken,
  updateDocument
);


router.patch(
  '/admin/:id/status',
  verifyToken,
  updateDocumentStatus
);


module.exports = router;