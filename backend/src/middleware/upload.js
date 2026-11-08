const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, config.INCOMING_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueName = `incoming_${Date.now()}_${uuidv4().substring(0, 8)}${ext}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow common image mime types
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are permitted.'));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: config.MAX_UPLOAD_SIZE
  },
  fileFilter
});

module.exports = upload;
