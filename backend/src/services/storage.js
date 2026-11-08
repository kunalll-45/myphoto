const fs = require('fs');
const path = require('path');
const config = require('../config');

// Lazy-load AWS S3 client only when S3 driver is active or initialized
let s3ClientInstance = null;

function getS3Client() {
  if (!s3ClientInstance) {
    const { S3Client } = require('@aws-sdk/client-s3');
    const clientConfig = {
      region: config.AWS_REGION
    };

    // If explicit credentials are provided in local env, use them;
    // otherwise S3Client uses default provider chain (EC2 IAM Role) automatically!
    if (config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY) {
      clientConfig.credentials = {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY
      };
    }

    s3ClientInstance = new S3Client(clientConfig);
  }
  return s3ClientInstance;
}

/**
 * Returns storage location / path for a key
 */
function getFilePath(key, type = 'processed') {
  if (!key) return null;
  if (type === 'incoming' || type === 'original') {
    return path.join(config.INCOMING_DIR, key);
  }
  return path.join(config.PROCESSED_DIR, key);
}

/**
 * Delete a local file safely if it exists
 */
function deleteFileIfExists(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error(`Failed to delete file at ${filePath}:`, err.message);
    }
  }
}

/**
 * Delete photo files from local storage or S3
 */
async function deletePhotoFiles(originalKey, processedKey, thumbnailKey) {
  if (config.STORAGE_DRIVER === 's3') {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = getS3Client();

    const deleteFromS3 = async (prefix, key) => {
      if (!key) return;
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: config.AWS_S3_BUCKET_NAME,
            Key: `${prefix}${key}`
          })
        );
      } catch (err) {
        console.error(`Failed to delete S3 object ${prefix}${key}:`, err.message);
      }
    };

    await Promise.all([
      deleteFromS3(config.AWS_S3_INCOMING_PREFIX, originalKey),
      deleteFromS3(config.AWS_S3_PROCESSED_PREFIX, processedKey),
      deleteFromS3(config.AWS_S3_PROCESSED_PREFIX, thumbnailKey)
    ]);
  } else {
    // Local storage
    if (originalKey) deleteFileIfExists(getFilePath(originalKey, 'incoming'));
    if (processedKey) deleteFileIfExists(getFilePath(processedKey, 'processed'));
    if (thumbnailKey) deleteFileIfExists(getFilePath(thumbnailKey, 'processed'));
  }
}

/**
 * Retrieve file as buffer (from local disk or S3)
 */
async function getFileBuffer(key, type = 'processed') {
  if (config.STORAGE_DRIVER === 's3') {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = getS3Client();
    const prefix = (type === 'incoming' || type === 'original')
      ? config.AWS_S3_INCOMING_PREFIX
      : config.AWS_S3_PROCESSED_PREFIX;

    const command = new GetObjectCommand({
      Bucket: config.AWS_S3_BUCKET_NAME,
      Key: `${prefix}${key}`
    });

    const response = await s3.send(command);
    const streamToBuffer = async (stream) => {
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    };
    return streamToBuffer(response.Body);
  } else {
    const filePath = getFilePath(key, type);
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`Local file not found: ${filePath}`);
    }
    return fs.readFileSync(filePath);
  }
}

/**
 * Save file buffer (to local disk or S3)
 */
async function saveFileBuffer(key, buffer, type = 'processed', mimeType = 'image/jpeg') {
  if (config.STORAGE_DRIVER === 's3') {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = getS3Client();
    const prefix = (type === 'incoming' || type === 'original')
      ? config.AWS_S3_INCOMING_PREFIX
      : config.AWS_S3_PROCESSED_PREFIX;

    await s3.send(
      new PutObjectCommand({
        Bucket: config.AWS_S3_BUCKET_NAME,
        Key: `${prefix}${key}`,
        Body: buffer,
        ContentType: mimeType
      })
    );
  } else {
    const filePath = getFilePath(key, type);
    fs.writeFileSync(filePath, buffer);
  }
}

module.exports = {
  getFilePath,
  deleteFileIfExists,
  deletePhotoFiles,
  getFileBuffer,
  saveFileBuffer
};
