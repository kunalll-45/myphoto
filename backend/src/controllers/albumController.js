const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/database');
const storage = require('../services/storage');

/**
 * GET /albums
 * Returns all albums for the logged-in user, including photo count and cover info.
 */
function getAlbums(req, res) {
  try {
    const userId = req.user.user_id;
    const db = getDatabase();

    const albums = db.prepare(`
      SELECT 
        a.album_id,
        a.user_id,
        a.album_name,
        a.cover_photo_id,
        a.created_at,
        COUNT(p.photo_id) AS photo_count,
        cp.thumbnail_key AS cover_thumbnail_key,
        cp.processed_key AS cover_processed_key
      FROM albums a
      LEFT JOIN photos p ON p.album_id = a.album_id AND p.processing_status = 'READY'
      LEFT JOIN photos cp ON cp.photo_id = a.cover_photo_id AND cp.processing_status = 'READY'
      WHERE a.user_id = ?
      GROUP BY a.album_id
      ORDER BY a.created_at DESC
    `).all(userId);

    return res.status(200).json({ albums });
  } catch (err) {
    console.error('Error getting albums:', err);
    return res.status(500).json({ error: 'Internal server error while fetching albums.' });
  }
}

/**
 * POST /albums
 * Create new album
 */
function createAlbum(req, res) {
  try {
    const userId = req.user.user_id;
    const { album_name } = req.body;

    if (!album_name || typeof album_name !== 'string' || !album_name.trim()) {
      return res.status(400).json({ error: 'Album name is required.' });
    }

    const albumId = uuidv4();
    const createdAt = new Date().toISOString();
    const db = getDatabase();

    db.prepare(`
      INSERT INTO albums (album_id, user_id, album_name, cover_photo_id, created_at)
      VALUES (?, ?, ?, NULL, ?)
    `).run(albumId, userId, album_name.trim(), createdAt);

    const createdAlbum = {
      album_id: albumId,
      user_id: userId,
      album_name: album_name.trim(),
      cover_photo_id: null,
      photo_count: 0,
      created_at: createdAt
    };

    return res.status(201).json({ album: createdAlbum });
  } catch (err) {
    console.error('Error creating album:', err);
    return res.status(500).json({ error: 'Internal server error while creating album.' });
  }
}

/**
 * PUT /albums/:id
 * Rename album or change cover photo
 */
function updateAlbum(req, res) {
  try {
    const userId = req.user.user_id;
    const albumId = req.params.id;
    const { album_name, cover_photo_id } = req.body;

    const db = getDatabase();
    const album = db.prepare('SELECT * FROM albums WHERE album_id = ? AND user_id = ?').get(albumId, userId);

    if (!album) {
      return res.status(404).json({ error: 'Album not found or access denied.' });
    }

    let updatedName = album.album_name;
    if (album_name !== undefined) {
      if (typeof album_name !== 'string' || !album_name.trim()) {
        return res.status(400).json({ error: 'Album name cannot be empty.' });
      }
      updatedName = album_name.trim();
    }

    let updatedCoverId = album.cover_photo_id;
    if (cover_photo_id !== undefined) {
      if (cover_photo_id === null || cover_photo_id === '') {
        updatedCoverId = null;
      } else {
        // Verify cover photo belongs to this user, album, and is READY
        const photo = db.prepare(`
          SELECT photo_id 
          FROM photos 
          WHERE photo_id = ? AND album_id = ? AND user_id = ? AND processing_status = 'READY'
        `).get(cover_photo_id, albumId, userId);

        if (!photo) {
          return res.status(400).json({ error: 'Invalid cover photo. Photo must exist in this album and be ready.' });
        }
        updatedCoverId = cover_photo_id;
      }
    }

    db.prepare(`
      UPDATE albums 
      SET album_name = ?, cover_photo_id = ?
      WHERE album_id = ?
    `).run(updatedName, updatedCoverId, albumId);

    const updatedAlbum = db.prepare(`
      SELECT 
        a.album_id,
        a.user_id,
        a.album_name,
        a.cover_photo_id,
        a.created_at,
        COUNT(p.photo_id) AS photo_count,
        cp.thumbnail_key AS cover_thumbnail_key,
        cp.processed_key AS cover_processed_key
      FROM albums a
      LEFT JOIN photos p ON p.album_id = a.album_id AND p.processing_status = 'READY'
      LEFT JOIN photos cp ON cp.photo_id = a.cover_photo_id AND cp.processing_status = 'READY'
      WHERE a.album_id = ?
      GROUP BY a.album_id
    `).get(albumId);

    return res.status(200).json({ album: updatedAlbum });
  } catch (err) {
    console.error('Error updating album:', err);
    return res.status(500).json({ error: 'Internal server error while updating album.' });
  }
}

/**
 * DELETE /albums/:id
 * Delete album and cleanly remove all its photos and files
 */
function deleteAlbum(req, res) {
  try {
    const userId = req.user.user_id;
    const albumId = req.params.id;
    const db = getDatabase();

    const album = db.prepare('SELECT * FROM albums WHERE album_id = ? AND user_id = ?').get(albumId, userId);
    if (!album) {
      return res.status(404).json({ error: 'Album not found or access denied.' });
    }

    // Retrieve all photos belonging to this album to delete their storage files
    const photosToDelete = db.prepare('SELECT original_key, processed_key, thumbnail_key FROM photos WHERE album_id = ? AND user_id = ?').all(albumId, userId);

    for (const photo of photosToDelete) {
      storage.deletePhotoFiles(photo.original_key, photo.processed_key, photo.thumbnail_key);
    }

    // Delete album (foreign key CASCADE in SQLite automatically deletes the photo rows)
    db.prepare('DELETE FROM albums WHERE album_id = ?').run(albumId);

    return res.status(200).json({ message: 'Album and associated photos deleted successfully.' });
  } catch (err) {
    console.error('Error deleting album:', err);
    return res.status(500).json({ error: 'Internal server error while deleting album.' });
  }
}

module.exports = {
  getAlbums,
  createAlbum,
  updateAlbum,
  deleteAlbum
};

