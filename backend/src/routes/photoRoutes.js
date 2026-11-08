const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photoController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /photos - Get all photos (ready status only)
router.get('/', photoController.getAllPhotos);

// GET /photos/:id/url - Get photo viewing URL
router.get('/:id/url', photoController.getPhotoUrl);

// GET /photos/:id/file - Stream photo image securely
router.get('/:id/file', photoController.getPhotoFile);

// DELETE /photos/:id - Delete photo
router.delete('/:id', photoController.deletePhoto);

module.exports = router;

