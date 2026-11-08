const sharp = require('sharp');
const config = require('../config');
const { getDatabase } = require('../db/database');
const storage = require('./storage');

/**
 * Image processing service
 * 1. Checks current photo status (handles duplicate processing events safely)
 * 2. Transitions status to PROCESSING
 * 3. Compresses original image and creates thumbnail using environment parameters
 * 4. Updates photo record to READY (or FAILED on error)
 *
 * Can receive custom options or read from environment configuration.
 */
async function processPhoto(photoId, options = {}) {
  const db = getDatabase();

  const photo = db.prepare('SELECT * FROM photos WHERE photo_id = ?').get(photoId);
  if (!photo) {
    throw new Error(`Photo with ID ${photoId} not found.`);
  }

  // Handle duplicate processing events safely
  if (photo.processing_status === 'READY') {
    return photo;
  }

  // Set status to PROCESSING
  db.prepare(`
    UPDATE photos 
    SET processing_status = 'PROCESSING' 
    WHERE photo_id = ?
  `).run(photoId);

  try {
    // Determine configuration parameters (environment variables with fallback to options)
    const quality = options.quality || parseInt(process.env.IMAGE_QUALITY, 10) || config.IMAGE_QUALITY || 80;
    const format = (options.format || process.env.IMAGE_FORMAT || config.IMAGE_FORMAT || 'jpeg').toLowerCase();
    const thumbWidth = options.thumbWidth || parseInt(process.env.THUMBNAIL_WIDTH, 10) || config.THUMBNAIL_WIDTH || 400;
    const thumbHeight = options.thumbHeight || parseInt(process.env.THUMBNAIL_HEIGHT, 10) || config.THUMBNAIL_HEIGHT || 400;

    const fileExt = format === 'webp' ? '.webp' : '.jpg';
    const processedKey = `processed_${photoId}${fileExt}`;
    const thumbnailKey = `thumb_${photoId}${fileExt}`;
    const outputMime = format === 'webp' ? 'image/webp' : 'image/jpeg';

    // 1. Fetch original file buffer (from local disk or S3)
    const inputBuffer = await storage.getFileBuffer(photo.original_key, 'incoming');

    // 2. Generate compressed image
    let sharpProcessed = sharp(inputBuffer)
      .rotate()
      .resize(1920, 1920, {
        fit: 'inside',
        withoutEnlargement: true
      });

    if (format === 'webp') {
      sharpProcessed = sharpProcessed.webp({ quality });
    } else {
      sharpProcessed = sharpProcessed.jpeg({ quality, progressive: true });
    }

    const processedBuffer = await sharpProcessed.toBuffer();

    // 3. Generate thumbnail
    let sharpThumbnail = sharp(inputBuffer)
      .rotate()
      .resize(thumbWidth, thumbHeight, {
        fit: 'cover',
        position: 'centre'
      });

    if (format === 'webp') {
      sharpThumbnail = sharpThumbnail.webp({ quality: Math.min(quality, 75) });
    } else {
      sharpThumbnail = sharpThumbnail.jpeg({ quality: Math.min(quality, 75) });
    }

    const thumbnailBuffer = await sharpThumbnail.toBuffer();

    // 4. Save processed and thumbnail buffers (to local disk or S3)
    await storage.saveFileBuffer(processedKey, processedBuffer, 'processed', outputMime);
    await storage.saveFileBuffer(thumbnailKey, thumbnailBuffer, 'processed', outputMime);

    const processedSize = processedBuffer.length;
    const processedAt = new Date().toISOString();

    // 5. Update database record to READY
    db.prepare(`
      UPDATE photos 
      SET 
        processed_key = ?,
        thumbnail_key = ?,
        processed_size = ?,
        processing_status = 'READY',
        processed_at = ?
      WHERE photo_id = ?
    `).run(processedKey, thumbnailKey, processedSize, processedAt, photoId);

    // If photo belongs to an album and album has no cover, set as cover
    if (photo.album_id) {
      const album = db.prepare('SELECT cover_photo_id FROM albums WHERE album_id = ?').get(photo.album_id);
      if (album && !album.cover_photo_id) {
        db.prepare('UPDATE albums SET cover_photo_id = ? WHERE album_id = ?').run(photoId, photo.album_id);
      }
    }

    const updatedPhoto = db.prepare('SELECT * FROM photos WHERE photo_id = ?').get(photoId);
    return updatedPhoto;

  } catch (err) {
    console.error(`Image processing failed for photo ${photoId}:`, err);
    // Failed processing must never mark photo as READY
    db.prepare(`
      UPDATE photos 
      SET processing_status = 'FAILED' 
      WHERE photo_id = ?
    `).run(photoId);

    throw err;
  }
}

module.exports = {
  processPhoto
};
