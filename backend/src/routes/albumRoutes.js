const express = require('express');
const router = express.Router();
const albumController = require('../controllers/albumController');
const photoController = require('../controllers/photoController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /albums - Get albums
router.get('/', albumController.getAlbums);

// POST /albums - Create album
router.post('/', albumController.createAlbum);

// PUT /albums/:id - Rename album / update cover
router.put('/:id', albumController.updateAlbum);

// DELETE /albums/:id - Delete album
router.delete('/:id', albumController.deleteAlbum);

// GET /albums/:id/photos - Get album photos
router.get('/:id/photos', photoController.getAlbumPhotos);

module.exports = router;

