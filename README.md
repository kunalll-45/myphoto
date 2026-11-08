# Cross-Platform Photo Gallery & Album Management Application

A modern, responsive, cross-platform Photo Gallery and Album Management application for **Android**, **iOS**, and **Web**, with an Express backend, native SQLite database, and automated Sharp image processing pipeline.

---

## Project Structure

```
demod/
├── backend/
│   ├── src/
│   │   ├── config/              # Server configuration and directory paths
│   │   ├── db/                  # SQLite schema, foreign keys, indexes & connection
│   │   ├── middleware/          # JWT auth verification, multer disk upload
│   │   ├── services/            # Image processing (Sharp) & storage file management
│   │   ├── controllers/         # Auth, Albums, Photos & Uploads controllers
│   │   ├── routes/              # Express routes matching specification exactly
│   │   ├── app.js               # Express application configuration
│   │   └── server.js            # Server entry point
│   ├── storage/
│   │   ├── incoming/            # Original uploaded photos
│   │   └── processed/           # Compressed images and thumbnails
│   ├── tests/
│   │   └── api.test.js          # Automated integration test suite
│   └── package.json
│
├── mobile/
│   ├── src/
│   │   ├── api/                 # API client, config & image URL helpers
│   │   ├── context/             # AuthContext (token storage via AsyncStorage)
│   │   ├── theme/               # Dark slate gallery theme constants
│   │   ├── components/
│   │   │   ├── Header.js        # Responsive app header with user profile & logout
│   │   │   ├── PhotoGrid.js     # Responsive photo grid (adaptive columns)
│   │   │   ├── AlbumCard.js     # Distinct album cards with cover & photo count
│   │   │   └── FullScreenViewer.js # Full-screen viewer with zoom & prev/next nav
│   │   └── screens/
│   │       ├── LoginScreen.js       # Secure user authentication (Sign In)
│   │       ├── RegisterScreen.js    # New user registration
│   │       ├── HomeScreen.js        # "All Photos" (READY photos grid)
│   │       ├── AlbumsScreen.js      # "My Albums" with rename & delete
│   │       ├── CreateAlbumModal.js  # Clean modal to create albums
│   │       ├── AlbumDetailScreen.js # Album photos, cover photo update, delete
│   │       └── UploadScreen.js      # Multi-photo picker, album selection & progress
│   ├── App.js                   # Navigation & bottom tabs shell
│   ├── app.json                 # Cross-platform Expo metadata & camera permissions
│   └── package.json
│
└── package.json                 # Root script runner
```

---

## Database Architecture

Implemented with SQLite (`node:sqlite`) with `PRAGMA foreign_keys = ON;` and `PRAGMA journal_mode = WAL;`.

- **Users**: `user_id` (PK), `name`, `email` (UNIQUE), `password_hash`, `created_at`.
- **Albums**: `album_id` (PK), `user_id` (FK -> users ON DELETE CASCADE), `album_name`, `cover_photo_id` (FK -> photos ON DELETE SET NULL), `created_at`.
- **Photos**: `photo_id` (PK), `user_id` (FK -> users ON DELETE CASCADE), `album_id` (FK -> albums ON DELETE CASCADE), `original_key`, `processed_key`, `thumbnail_key`, `original_size`, `processed_size`, `mime_type`, `processing_status` (UPLOADING, PROCESSING, READY, FAILED), `uploaded_at`, `processed_at`.
- **Indexes**:
  - `idx_users_email` ON users(email)
  - `idx_albums_user_id` ON albums(user_id)
  - `idx_photos_user_status` ON photos(user_id, processing_status)
  - `idx_photos_album_status` ON photos(album_id, processing_status)

---

## Photo Processing Workflow

1. User selects multiple photos from device using `expo-image-picker`.
2. User selects destination album.
3. Mobile app posts files to `POST /uploads/initiate`.
4. Photos are stored in `backend/storage/incoming/` with status `UPLOADING`.
5. Image processor changes status to `PROCESSING`.
6. Sharp rotates based on EXIF, compresses max dimension to 1920px (JPEG q80), generates 400x400 center-crop thumbnail (JPEG q75) into `backend/storage/processed/`.
7. Photo record is updated with `processed_key`, `thumbnail_key`, `processed_size`, `processed_at`, and status set to `READY`.
8. Album cover photo is automatically set to the first photo if none exists.
9. Only photos with `READY` status are displayed in "All Photos" and album views.

---

## Backend API Specification

| Method | Endpoint | Purpose | Authorization |
|---|---|---|---|
| `POST` | `/auth/register` | Register user | Public |
| `POST` | `/auth/login` | Login | Public |
| `GET` | `/albums` | Get all user albums with photo count and cover info | Bearer Token |
| `POST` | `/albums` | Create album | Bearer Token |
| `PUT` | `/albums/:id` | Rename album / set cover photo | Bearer Token |
| `DELETE` | `/albums/:id` | Delete album & remove its files from storage | Bearer Token |
| `POST` | `/uploads/initiate` | Upload and process photos | Bearer Token |
| `GET` | `/photos` | Get all user photos with READY status | Bearer Token |
| `GET` | `/albums/:id/photos` | Get album photos with READY status | Bearer Token |
| `GET` | `/photos/:id/url` | Get photo viewing URLs | Bearer Token |
| `GET` | `/photos/:id/file` | Securely stream image (`type=processed\|thumbnail\|original`) | Bearer Token / Query |
| `DELETE` | `/photos/:id` | Delete photo and remove its files from storage | Bearer Token |

---

## Running the Application

### 1. Run Backend Integration Tests
```bash
npm run backend:test
```

### 2. Start Backend Server
```bash
npm run backend:start
```
The server will run on `http://localhost:5000`.

### 3. Start Mobile Application
```bash
# Android Emulator / Device
npm run mobile:android

# iOS Simulator (macOS)
npm run mobile:ios

# Web Browser Preview
npm run mobile:web
```

