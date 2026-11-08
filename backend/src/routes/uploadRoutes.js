const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photoController');
const upload = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// POST /uploads/initiate - Initiate photo upload (accepts multipart or metadata)
router.post('/initiate', upload.array('photos', 20), photoController.initiateUpload);

// POST /uploads/:id/file - Upload binary file for initiated photo
router.post('/:id/file', upload.single('photo'), photoController.uploadFileForPhoto);

module.exports = router;

