const multer = require('multer');

const storage = multer.memoryStorage();

const uploadDocument = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {

    const allowedTypes = [
      'application/pdf'
    ];

    if (!allowedTypes.includes(file.mimetype)) {

      return cb(
        new Error('Only PDF documents are allowed.')
      );

    }

    cb(null, true);

  }

});

module.exports = uploadDocument;