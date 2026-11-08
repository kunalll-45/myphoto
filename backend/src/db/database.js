const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

let dbInstance = null;

function initDatabase(dbPath = config.DB_PATH) {
  if (dbInstance) {
    return dbInstance;
  }

  const db = new DatabaseSync(dbPath);

  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  // Create Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Create Albums table
  db.exec(`
    CREATE TABLE IF NOT EXISTS albums (
      album_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      album_name TEXT NOT NULL,
      cover_photo_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (cover_photo_id) REFERENCES photos(photo_id) ON DELETE SET NULL
    );
  `);

  // Create Photos table (album_id is nullable to allow photos directly in All Photos)
  db.exec(`
    CREATE TABLE IF NOT EXISTS photos (
      photo_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      album_id TEXT,
      original_key TEXT NOT NULL,
      processed_key TEXT,
      thumbnail_key TEXT,
      original_size INTEGER NOT NULL,
      processed_size INTEGER,
      mime_type TEXT NOT NULL,
      processing_status TEXT NOT NULL CHECK(processing_status IN ('UPLOADING', 'PROCESSING', 'READY', 'FAILED')),
      uploaded_at TEXT NOT NULL,
      processed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (album_id) REFERENCES albums(album_id) ON DELETE CASCADE
    );
  `);

  // Automatic Migration: If an existing photos table has album_id as NOT NULL, migrate it safely
  try {
    const photoCols = db.prepare('PRAGMA table_info(photos)').all();
    const albumIdCol = photoCols.find(c => c.name === 'album_id');
    if (albumIdCol && albumIdCol.notnull === 1) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE IF NOT EXISTS photos_mig_temp (
          photo_id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          album_id TEXT,
          original_key TEXT NOT NULL,
          processed_key TEXT,
          thumbnail_key TEXT,
          original_size INTEGER NOT NULL,
          processed_size INTEGER,
          mime_type TEXT NOT NULL,
          processing_status TEXT NOT NULL CHECK(processing_status IN ('UPLOADING', 'PROCESSING', 'READY', 'FAILED')),
          uploaded_at TEXT NOT NULL,
          processed_at TEXT,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
          FOREIGN KEY (album_id) REFERENCES albums(album_id) ON DELETE CASCADE
        );
        INSERT INTO photos_mig_temp SELECT * FROM photos;
        DROP TABLE photos;
        ALTER TABLE photos_mig_temp RENAME TO photos;
        PRAGMA foreign_keys = ON;
      `);
      console.log('Database migrated: photos.album_id now allows NULL.');
    }
  } catch (migErr) {
    console.error('Migration notice:', migErr.message);
  }

  // Create Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_albums_user_id ON albums(user_id);
    CREATE INDEX IF NOT EXISTS idx_photos_user_status ON photos(user_id, processing_status);
    CREATE INDEX IF NOT EXISTS idx_photos_album_status ON photos(album_id, processing_status);
  `);

  dbInstance = db;
  return db;
}

function getDatabase() {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

module.exports = {
  initDatabase,
  getDatabase
};
