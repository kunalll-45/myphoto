const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { getDatabase } = require('../db/database');
const storage = require('../services/storage');
const imageProcessor = require('../services/imageProcessor');

/**
 * POST /uploads/initiate
 * Handles upload initiation. Supports uploading into an album OR directly to All Photos
 * without requiring an existing album.
 */
async function initiateUpload(req, res) {
  try {
    const userId = req.user.user_id;
    let albumId = req.body.album_id;

    // Normalize albumId (allow null/empty for uploading directly to All Photos)
    if (!albumId || albumId === 'null' || albumId === 'none' || albumId === 'undefined' || !albumId.trim()) {
      albumId = null;
    }

    const db = getDatabase();

    // If destination album was specified, verify it exists and belongs to the user
    if (albumId) {
      const album = db.prepare('SELECT album_id FROM albums WHERE album_id = ? AND user_id = ?').get(albumId, userId);
      if (!album) {
        return res.status(404).json({ error: 'Destination album not found or access denied.' });
      }
    }

    // Check if multipart files are present
    const uploadedFiles = req.files || (req.file ? [req.file] : []);

    if (uploadedFiles.length > 0) {
      const results = [];

      for (const file of uploadedFiles) {
        const photoId = uuidv4();
        const originalKey = path.basename(file.path);
        const uploadedAt = new Date().toISOString();

        // If S3 storage is enabled, also upload original file to S3
        if (config.STORAGE_DRIVER === 's3') {
          const fileBuffer = fs.readFileSync(file.path);
          await storage.saveFileBuffer(originalKey, fileBuffer, 'incoming', file.mimetype || 'image/jpeg');
        }

        // 1. Store photo record with UPLOADING status (album_id can be null)
        db.prepare(`
          INSERT INTO photos (
            photo_id, user_id, album_id, original_key,
            processed_key, thumbnail_key, original_size,
            processed_size, mime_type, processing_status,
            uploaded_at, processed_at
          ) VALUES (?, ?, ?, ?, NULL, NULL, ?, NULL, ?, 'UPLOADING', ?, NULL)
        `).run(photoId, userId, albumId, originalKey, file.size, file.mimetype || 'image/jpeg', uploadedAt);

        // 2. Trigger image-processing workflow
        try {
          const processedPhoto = await imageProcessor.processPhoto(photoId);
          results.push(processedPhoto);
        } catch (procErr) {
          console.error(`Failed to process uploaded photo ${photoId}:`, procErr);
          const failedPhoto = db.prepare('SELECT * FROM photos WHERE photo_id = ?').get(photoId);
          results.push(failedPhoto);
        }
      }

      return res.status(201).json({
        message: 'Upload and processing complete.',
        photos: results
      });
    }

    // Metadata-only initiation
    const { filename, mime_type, file_size } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'Either photo files or filename metadata must be provided.' });
    }

    const photoId = uuidv4();
    const ext = path.extname(filename) || '.jpg';
    const originalKey = `orig_${photoId}${ext}`;
    const uploadedAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO photos (
        photo_id, user_id, album_id, original_key,
        processed_key, thumbnail_key, original_size,
        processed_size, mime_type, processing_status,
        uploaded_at, processed_at
      ) VALUES (?, ?, ?, ?, NULL, NULL, ?, NULL, ?, 'UPLOADING', ?, NULL)
    `).run(photoId, userId, albumId, originalKey, file_size || 0, mime_type || 'image/jpeg', uploadedAt);

    return res.status(201).json({
      message: 'Upload initiated.',
      photo_id: photoId,
      original_key: originalKey,
      upload_url: `/uploads/${photoId}/file`,
      processing_status: 'UPLOADING'
    });

  } catch (err) {
    console.error('Error initiating upload:', err);
    return res.status(500).json({ error: 'Internal server error during upload initiation.' });
  }
}

/**
 * Upload single binary file for an initiated photo record
 */
async function uploadFileForPhoto(req, res) {
  try {
    const userId = req.user.user_id;
    const photoId = req.params.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    const db = getDatabase();
    const photo = db.prepare('SELECT * FROM photos WHERE photo_id = ? AND user_id = ?').get(photoId, userId);
    if (!photo) {
      return res.status(404).json({ error: 'Photo record not found or access denied.' });
    }

    const originalKey = path.basename(req.file.path);

    if (config.STORAGE_DRIVER === 's3') {
      const fileBuffer = fs.readFileSync(req.file.path);
      await storage.saveFileBuffer(originalKey, fileBuffer, 'incoming', req.file.mimetype || photo.mime_type);
    }

    db.prepare(`
      UPDATE photos 
      SET original_key = ?, original_size = ?, mime_type = ?
      WHERE photo_id = ?
    `).run(originalKey, req.file.size, req.file.mimetype || photo.mime_type, photoId);

    const processedPhoto = await imageProcessor.processPhoto(photoId);

    return res.status(200).json({
      message: 'Photo uploaded and processed successfully.',
      photo: processedPhoto
    });
  } catch (err) {
    console.error('Error uploading photo file:', err);
    return res.status(500).json({ error: 'Failed to process uploaded file.' });
  }
}

/**
 * GET /photos
 * Display all successfully processed photos uploaded by the logged-in user.
 * Only READY photos are returned.
 */
function getAllPhotos(req, res) {
  try {
    const userId = req.user.user_id;
    const db = getDatabase();

    const photos = db.prepare(`
      SELECT 
        p.photo_id,
        p.user_id,
        p.album_id,
        COALESCE(a.album_name, 'All Photos') AS album_name,
        p.original_key,
        p.processed_key,
        p.thumbnail_key,
        p.original_size,
        p.processed_size,
        p.mime_type,
        p.processing_status,
        p.uploaded_at,
        p.processed_at
      FROM photos p
      LEFT JOIN albums a ON a.album_id = p.album_id
      WHERE p.user_id = ? AND p.processing_status = 'READY'
      ORDER BY p.uploaded_at DESC
    `).all(userId);

    return res.status(200).json({ photos });
  } catch (err) {
    console.error('Error fetching all photos:', err);
    return res.status(500).json({ error: 'Internal server error while fetching photos.' });
  }
}

/**
 * GET /albums/:id/photos
 * Display all successfully processed photos belonging to the selected album.
 */
function getAlbumPhotos(req, res) {
  try {
    const userId = req.user.user_id;
    const albumId = req.params.id;
    const db = getDatabase();

    const album = db.prepare('SELECT album_id, album_name, cover_photo_id FROM albums WHERE album_id = ? AND user_id = ?').get(albumId, userId);
    if (!album) {
      return res.status(404).json({ error: 'Album not found or access denied.' });
    }

    const photos = db.prepare(`
      SELECT 
        p.photo_id,
        p.user_id,
        p.album_id,
        a.album_name,
        p.original_key,
        p.processed_key,
        p.thumbnail_key,
        p.original_size,
        p.processed_size,
        p.mime_type,
        p.processing_status,
        p.uploaded_at,
        p.processed_at
      FROM photos p
      LEFT JOIN albums a ON a.album_id = p.album_id
      WHERE p.album_id = ? AND p.user_id = ? AND p.processing_status = 'READY'
      ORDER BY p.uploaded_at DESC
    `).all(albumId, userId);

    return res.status(200).json({
      album,
      photos
    });
  } catch (err) {
    console.error('Error fetching album photos:', err);
    return res.status(500).json({ error: 'Internal server error while fetching album photos.' });
  }
}

/**
 * GET /photos/:id/url
 * Get photo viewing URLs
 */
function getPhotoUrl(req, res) {
  try {
    const userId = req.user.user_id;
    const photoId = req.params.id;
    const db = getDatabase();

    const photo = db.prepare('SELECT * FROM photos WHERE photo_id = ? AND user_id = ?').get(photoId, userId);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found or access denied.' });
    }

    const baseUrl = `/photos/${photoId}/file`;
    return res.status(200).json({
      photo_id: photoId,
      processing_status: photo.processing_status,
      urls: {
        thumbnail: `${baseUrl}?type=thumbnail`,
        processed: `${baseUrl}?type=processed`,
        original: `${baseUrl}?type=original`
      }
    });
  } catch (err) {
    console.error('Error fetching photo URL:', err);
    return res.status(500).json({ error: 'Internal server error while fetching photo URL.' });
  }
}

/**
 * GET /photos/:id/file
 * Serves photo file securely with authentication and user authorization
 */
async function getPhotoFile(req, res) {
  try {
    const userId = req.user.user_id;
    const photoId = req.params.id;
    const type = req.query.type || 'processed';

    const db = getDatabase();
    const photo = db.prepare('SELECT * FROM photos WHERE photo_id = ? AND user_id = ?').get(photoId, userId);

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found or access denied.' });
    }

    if (photo.processing_status !== 'READY' && type !== 'original') {
      return res.status(400).json({ error: 'Photo is still processing or has failed.' });
    }

    let fileKey = null;
    let storageType = 'processed';

    if (type === 'thumbnail') {
      fileKey = photo.thumbnail_key;
    } else if (type === 'original') {
      fileKey = photo.original_key;
      storageType = 'incoming';
    } else {
      fileKey = photo.processed_key;
    }

    if (!fileKey) {
      return res.status(404).json({ error: 'File key not found.' });
    }

    const mimeType = (config.IMAGE_FORMAT === 'webp' && type !== 'original') ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    if (config.STORAGE_DRIVER === 's3') {
      const buffer = await storage.getFileBuffer(fileKey, storageType);
      return res.send(buffer);
    } else {
      const filePath = storage.getFilePath(fileKey, storageType);
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found on storage server.' });
      }
      return fs.createReadStream(filePath).pipe(res);
    }

  } catch (err) {
    console.error('Error serving photo file:', err);
    return res.status(500).json({ error: 'Internal server error while serving file.' });
  }
}

/**
 * DELETE /photos/:id
 * Delete photo and associated stored files
 */
async function deletePhoto(req, res) {
  try {
    const userId = req.user.user_id;
    const photoId = req.params.id;
    const db = getDatabase();

    const photo = db.prepare('SELECT * FROM photos WHERE photo_id = ? AND user_id = ?').get(photoId, userId);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found or access denied.' });
    }

    // 1. Delete associated stored files from disk or S3
    await storage.deletePhotoFiles(photo.original_key, photo.processed_key, photo.thumbnail_key);

    // 2. If photo was album cover, update album cover
    if (photo.album_id) {
      db.prepare(`
        UPDATE albums 
        SET cover_photo_id = (
          SELECT photo_id 
          FROM photos 
          WHERE album_id = ? AND photo_id != ? AND processing_status = 'READY' 
          LIMIT 1
        ) 
        WHERE cover_photo_id = ?
      `).run(photo.album_id, photoId, photoId);
    }

    // 3. Delete photo record from DB
    db.prepare('DELETE FROM photos WHERE photo_id = ?').run(photoId);

    return res.status(200).json({ message: 'Photo deleted successfully.' });
  } catch (err) {
    console.error('Error deleting photo:', err);
    return res.status(500).json({ error: 'Internal server error while deleting photo.' });
  }
}

module.exports = {
  initiateUpload,
  uploadFileForPhoto,
  getAllPhotos,
  getAlbumPhotos,
  getPhotoUrl,
  getPhotoFile,
  deletePhoto
};
