const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env file if present
dotenv.config();

// Helper to parse integers with fallback
function parseIntEnv(val, fallback) {
  if (val === undefined || val === null || val === '') return fallback;
  const num = parseInt(val, 10);
  return isNaN(num) ? fallback : num;
}

// Helper to parse booleans
function parseBoolEnv(val, fallback = false) {
  if (val === undefined || val === null || val === '') return fallback;
  const s = String(val).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

// 1. Backend & Server Configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const HOST = process.env.HOST || '0.0.0.0'; // Bind to 0.0.0.0 for EC2 and Docker compatibility
const PORT = parseIntEnv(process.env.PORT, 5000);
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${PORT}`;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const TRUST_PROXY = process.env.TRUST_PROXY !== undefined ? process.env.TRUST_PROXY : '1'; // ALB forward support

// Authentication
const JWT_SECRET = process.env.JWT_SECRET || 'antigravity-photo-vault-jwt-secret-key-prod-ready-987213';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 2. AWS Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'photo-vault-gallery-bucket';
const AWS_S3_INCOMING_PREFIX = process.env.AWS_S3_INCOMING_PREFIX || 'incoming/';
const AWS_S3_PROCESSED_PREFIX = process.env.AWS_S3_PROCESSED_PREFIX || 'processed/';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || null;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || null;

// 3. Storage Configuration
const STORAGE_DRIVER = (process.env.STORAGE_DRIVER || 'local').toLowerCase(); // 'local' | 's3'
const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(__dirname, '../../storage');
const INCOMING_DIR = path.join(STORAGE_ROOT, 'incoming');
const PROCESSED_DIR = path.join(STORAGE_ROOT, 'processed');
const DATA_DIR = path.join(__dirname, '../../data');

// 4. Database Configuration
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseIntEnv(process.env.DB_PORT, 5432);
const DB_NAME = process.env.DB_NAME || 'gallery.db';
const DB_USER = process.env.DB_USER || 'gallery_user';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_SSL = parseBoolEnv(process.env.DB_SSL, false);
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, DB_NAME.endsWith('.db') ? DB_NAME : `${DB_NAME}.db`);

// 5. Image Processing Configuration
const IMAGE_QUALITY = parseIntEnv(process.env.IMAGE_QUALITY, 80);
const IMAGE_FORMAT = (process.env.IMAGE_FORMAT || 'jpeg').toLowerCase();
const THUMBNAIL_WIDTH = parseIntEnv(process.env.THUMBNAIL_WIDTH, 400);
const THUMBNAIL_HEIGHT = parseIntEnv(process.env.THUMBNAIL_HEIGHT, 400);
const MAX_UPLOAD_SIZE = parseIntEnv(process.env.MAX_UPLOAD_SIZE, 50 * 1024 * 1024); // 50MB default

// Ensure local directories exist if using local storage
if (STORAGE_DRIVER === 'local') {
  [STORAGE_ROOT, INCOMING_DIR, PROCESSED_DIR, DATA_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (e) {}
    }
  });
}

/**
 * Validate configuration on application boot
 */
function validateConfig() {
  const errors = [];

  if (PORT <= 0 || PORT > 65535) {
    errors.push(`Invalid PORT: ${PORT}. Must be an integer between 1 and 65535.`);
  }

  if (!JWT_SECRET || JWT_SECRET.trim().length < 8) {
    errors.push('JWT_SECRET must be configured and at least 8 characters long.');
  }

  if (IMAGE_QUALITY < 1 || IMAGE_QUALITY > 100) {
    errors.push(`Invalid IMAGE_QUALITY: ${IMAGE_QUALITY}. Must be between 1 and 100.`);
  }

  if (THUMBNAIL_WIDTH <= 0 || THUMBNAIL_HEIGHT <= 0) {
    errors.push('THUMBNAIL_WIDTH and THUMBNAIL_HEIGHT must be positive integers.');
  }

  if (MAX_UPLOAD_SIZE <= 0) {
    errors.push('MAX_UPLOAD_SIZE must be a positive integer.');
  }

  if (STORAGE_DRIVER === 's3') {
    if (!AWS_S3_BUCKET_NAME) {
      errors.push('AWS_S3_BUCKET_NAME is required when STORAGE_DRIVER is set to "s3".');
    }
    if (!AWS_REGION) {
      errors.push('AWS_REGION is required when STORAGE_DRIVER is set to "s3".');
    }
  }

  if (errors.length > 0) {
    console.error('================ CONFIGURATION ERROR ================');
    errors.forEach((err) => console.error(` [!] ${err}`));
    console.error('=====================================================');
    throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
  }

  return true;
}

/**
 * Safe logger for configuration (masks secrets)
 */
function logConfig() {
  console.log('--- Photo Vault Environment Configuration ---');
  console.log(` Environment:        ${NODE_ENV}`);
  console.log(` Host & Port:        ${HOST}:${PORT}`);
  console.log(` API Base URL:       ${API_BASE_URL}`);
  console.log(` CORS Origin:        ${CORS_ORIGIN}`);
  console.log(` Trust Proxy (ALB):  ${TRUST_PROXY}`);
  console.log(` Storage Driver:     ${STORAGE_DRIVER}`);
  if (STORAGE_DRIVER === 's3') {
    console.log(` S3 Bucket:          ${AWS_S3_BUCKET_NAME} (${AWS_REGION})`);
    console.log(` S3 Incoming Prefix: ${AWS_S3_INCOMING_PREFIX}`);
    console.log(` S3 Processed Prefix:${AWS_S3_PROCESSED_PREFIX}`);
    console.log(` AWS Auth:           ${AWS_ACCESS_KEY_ID ? 'Explicit Keys' : 'EC2 IAM Role'}`);
  } else {
    console.log(` Storage Root:       ${STORAGE_ROOT}`);
  }
  console.log(` Database:           ${DB_PATH}`);
  console.log(` Image Processing:   ${IMAGE_FORMAT.toUpperCase()} Q${IMAGE_QUALITY}, Thumb: ${THUMBNAIL_WIDTH}x${THUMBNAIL_HEIGHT}`);
  console.log(` Max Upload Size:    ${Math.round(MAX_UPLOAD_SIZE / (1024 * 1024))} MB`);
  console.log('---------------------------------------------');
}

module.exports = {
  NODE_ENV,
  HOST,
  PORT,
  API_BASE_URL,
  CORS_ORIGIN,
  TRUST_PROXY,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  AWS_REGION,
  AWS_S3_BUCKET_NAME,
  AWS_S3_INCOMING_PREFIX,
  AWS_S3_PROCESSED_PREFIX,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  STORAGE_DRIVER,
  STORAGE_ROOT,
  INCOMING_DIR,
  PROCESSED_DIR,
  DATA_DIR,
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_SSL,
  DB_PATH,
  IMAGE_QUALITY,
  IMAGE_FORMAT,
  THUMBNAIL_WIDTH,
  THUMBNAIL_HEIGHT,
  MAX_UPLOAD_SIZE,
  validateConfig,
  logConfig
};
