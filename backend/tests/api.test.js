const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Set test environment
const testDir = path.join(__dirname, '../data/test_env_' + Date.now());
process.env.STORAGE_ROOT = path.join(testDir, 'storage');
process.env.DB_PATH = path.join(testDir, 'test.db');

const config = require('../src/config');
const { initDatabase } = require('../src/db/database');
const app = require('../src/app');
const imageProcessor = require('../src/services/imageProcessor');
const storage = require('../src/services/storage');

// Initialize database
initDatabase(process.env.DB_PATH);

// Helper for HTTP requests against express app
async function makeRequest(method, url, { headers = {}, body = null, isFormData = false, formDataBoundary = null } = {}) {
  const http = require('http');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path: url,
      method,
      headers: { ...headers }
    };

    if (body && !Buffer.isBuffer(body) && !options.headers['Content-Type']) {
      const data = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        server.close();
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString('utf8');
        let json = null;
        try {
          json = JSON.parse(text);
        } catch (e) {
          json = null;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
          text,
          buffer
        });
      });
    });

    req.on('error', (err) => {
      server.close();
      reject(err);
    });

    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

// Multipart builder helper
function buildMultipart(fields, files) {
  const boundary = '----TestBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';
  const parts = [];

  for (const [name, val] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="${name}"${crlf}${crlf}${val}${crlf}`));
  }

  for (const file of files) {
    parts.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="${file.field}"; filename="${file.name}"${crlf}Content-Type: ${file.type}${crlf}${crlf}`));
    parts.push(file.content);
    parts.push(Buffer.from(crlf));
  }

  parts.push(Buffer.from(`--${boundary}--${crlf}`));
  const buffer = Buffer.concat(parts);

  return {
    boundary,
    buffer,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': buffer.length
    }
  };
}

test('Photo Gallery API & Workflow Complete Test Suite', async (t) => {
  let user1Token = null;
  let user2Token = null;
  let user1Id = null;
  let user2Id = null;
  let album1Id = null;
  let album2Id = null;
  let photo1Id = null;
  let photo2Id = null;

  // Cleanup at end
  t.after(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch (e) {}
  });

  await t.test('1. Auth: User registration and login', async () => {
    // Register User 1
    const regRes1 = await makeRequest('POST', '/auth/register', {
      body: { name: 'Alice Walker', email: 'alice@example.com', password: 'password123' }
    });
    assert.equal(regRes1.status, 201);
    assert.ok(regRes1.body.token);
    assert.equal(regRes1.body.user.email, 'alice@example.com');
    user1Token = regRes1.body.token;
    user1Id = regRes1.body.user.user_id;

    // Reject duplicate email
    const dupRes = await makeRequest('POST', '/auth/register', {
      body: { name: 'Alice Again', email: 'alice@example.com', password: 'password123' }
    });
    assert.equal(dupRes.status, 409);

    // Login User 1
    const loginRes = await makeRequest('POST', '/auth/login', {
      body: { email: 'alice@example.com', password: 'password123' }
    });
    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.body.token);

    // Reject wrong password
    const failLogin = await makeRequest('POST', '/auth/login', {
      body: { email: 'alice@example.com', password: 'wrongpassword' }
    });
    assert.equal(failLogin.status, 401);

    // Register User 2
    const regRes2 = await makeRequest('POST', '/auth/register', {
      body: { name: 'Bob Smith', email: 'bob@example.com', password: 'password456' }
    });
    assert.equal(regRes2.status, 201);
    user2Token = regRes2.body.token;
    user2Id = regRes2.body.user.user_id;
  });

  await t.test('2. Albums: Create, Rename, User Isolation', async () => {
    // User 1 creates Album 1
    const createRes1 = await makeRequest('POST', '/albums', {
      headers: { Authorization: `Bearer ${user1Token}` },
      body: { album_name: 'Summer Vacation' }
    });
    assert.equal(createRes1.status, 201);
    assert.equal(createRes1.body.album.album_name, 'Summer Vacation');
    album1Id = createRes1.body.album.album_id;

    // User 1 creates Album 2
    const createRes2 = await makeRequest('POST', '/albums', {
      headers: { Authorization: `Bearer ${user1Token}` },
      body: { album_name: 'Nature Landscapes' }
    });
    assert.equal(createRes2.status, 201);
    album2Id = createRes2.body.album.album_id;

    // User 1 renames Album 1
    const renameRes = await makeRequest('PUT', `/albums/${album1Id}`, {
      headers: { Authorization: `Bearer ${user1Token}` },
      body: { album_name: 'Summer Vacation 2026' }
    });
    assert.equal(renameRes.status, 200);
    assert.equal(renameRes.body.album.album_name, 'Summer Vacation 2026');

    // User 1 lists albums
    const listRes1 = await makeRequest('GET', '/albums', {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert.equal(listRes1.status, 200);
    assert.equal(listRes1.body.albums.length, 2);

    // User 2 lists albums (must be 0 - strict user isolation)
    const listRes2 = await makeRequest('GET', '/albums', {
      headers: { Authorization: `Bearer ${user2Token}` }
    });
    assert.equal(listRes2.status, 200);
    assert.equal(listRes2.body.albums.length, 0);

    // User 2 cannot rename User 1's album
    const forbiddenRename = await makeRequest('PUT', `/albums/${album1Id}`, {
      headers: { Authorization: `Bearer ${user2Token}` },
      body: { album_name: 'Hacked Album' }
    });
    assert.equal(forbiddenRename.status, 404);
  });

  await t.test('3. Uploads & Image Processing Workflow', async () => {
    // Generate two sample test JPEG buffers using sharp
    const testImg1Buffer = await sharp({
      create: {
        width: 600,
        height: 400,
        channels: 3,
        background: { r: 50, g: 150, b: 250 }
      }
    }).jpeg().toBuffer();

    const testImg2Buffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 250, g: 100, b: 50 }
      }
    }).jpeg().toBuffer();

    // Upload multiple photos to Album 1
    const mp = buildMultipart(
      { album_id: album1Id },
      [
        { field: 'photos', name: 'beach.jpg', type: 'image/jpeg', content: testImg1Buffer },
        { field: 'photos', name: 'sunset.jpg', type: 'image/jpeg', content: testImg2Buffer }
      ]
    );

    const uploadRes = await makeRequest('POST', '/uploads/initiate', {
      headers: {
        Authorization: `Bearer ${user1Token}`,
        ...mp.headers
      },
      body: mp.buffer
    });

    assert.equal(uploadRes.status, 201);
    assert.equal(uploadRes.body.photos.length, 2);

    const p1 = uploadRes.body.photos[0];
    const p2 = uploadRes.body.photos[1];

    assert.equal(p1.processing_status, 'READY');
    assert.equal(p2.processing_status, 'READY');
    assert.ok(p1.original_key);
    assert.ok(p1.processed_key);
    assert.ok(p1.thumbnail_key);
    assert.ok(p1.processed_size > 0);
    assert.ok(p1.processed_at);

    photo1Id = p1.photo_id;
    photo2Id = p2.photo_id;

    // Verify storage files exist on disk
    const origPath1 = path.join(config.INCOMING_DIR, p1.original_key);
    const procPath1 = path.join(config.PROCESSED_DIR, p1.processed_key);
    const thumbPath1 = path.join(config.PROCESSED_DIR, p1.thumbnail_key);

    assert.ok(fs.existsSync(origPath1), 'Original file should exist in incoming storage');
    assert.ok(fs.existsSync(procPath1), 'Processed file should exist in processed storage');
    assert.ok(fs.existsSync(thumbPath1), 'Thumbnail file should exist in processed storage');

    // Test duplicate processing event handling safely
    const dupProcessResult = await imageProcessor.processPhoto(photo1Id);
    assert.equal(dupProcessResult.processing_status, 'READY');
  });

  await t.test('4. Photo Querying, Filtering & File Serving', async () => {
    // GET /photos - All READY photos for User 1
    const allPhotosRes = await makeRequest('GET', '/photos', {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert.equal(allPhotosRes.status, 200);
    assert.equal(allPhotosRes.body.photos.length, 2);

    // GET /albums/:id/photos - Photos for Album 1
    const albumPhotosRes = await makeRequest('GET', `/albums/${album1Id}/photos`, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert.equal(albumPhotosRes.status, 200);
    assert.equal(albumPhotosRes.body.photos.length, 2);

    // Photos for empty Album 2
    const emptyAlbumRes = await makeRequest('GET', `/albums/${album2Id}/photos`, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert.equal(emptyAlbumRes.status, 200);
    assert.equal(emptyAlbumRes.body.photos.length, 0);

    // User 2 cannot access Album 1 photos
    const user2AlbumAccess = await makeRequest('GET', `/albums/${album1Id}/photos`, {
      headers: { Authorization: `Bearer ${user2Token}` }
    });
    assert.equal(user2AlbumAccess.status, 404);

    // GET /photos/:id/url
    const urlRes = await makeRequest('GET', `/photos/${photo1Id}/url`, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert.equal(urlRes.status, 200);
    assert.ok(urlRes.body.urls.processed);
    assert.ok(urlRes.body.urls.thumbnail);
    assert.ok(urlRes.body.urls.original);

    // GET /photos/:id/file (processed)
    const fileRes = await makeRequest('GET', `/photos/${photo1Id}/file?type=processed`, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert.equal(fileRes.status, 200);
    assert.equal(fileRes.headers['content-type'], 'image/jpeg');
    assert.ok(fileRes.buffer.length > 0);

    // GET /photos/:id/file (thumbnail)
    const thumbFileRes = await makeRequest('GET', `/photos/${photo1Id}/file?type=thumbnail`, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert.equal(thumbFileRes.status, 200);
    assert.ok(thumbFileRes.buffer.length > 0);

    // User 2 cannot access User 1's photo file
    const user2FileAccess = await makeRequest('GET', `/photos/${photo1Id}/file?type=processed`, {
      headers: { Authorization: `Bearer ${user2Token}` }
    });
    assert.equal(user2FileAccess.status, 404);
  });

  await t.test('5. Non-READY status photos must NOT be displayed', async () => {
    const { getDatabase } = require('../src/db/database');
    const db = getDatabase();

    // Insert simulated UPLOADING photo
    db.prepare(`
      INSERT INTO photos (
        photo_id, user_id, album_id, original_key, processed_key,
        thumbnail_key, original_size, processed_size, mime_type,
        processing_status, uploaded_at, processed_at
      ) VALUES ('sim-uploading-1', ?, ?, 'test_orig', NULL, NULL, 100, NULL, 'image/jpeg', 'UPLOADING', ?, NULL)
    `).run(user1Id, album1Id, new Date().toISOString());

    // Insert simulated FAILED photo
    db.prepare(`
      INSERT INTO photos (
        photo_id, user_id, album_id, original_key, processed_key,
        thumbnail_key, original_size, processed_size, mime_type,
        processing_status, uploaded_at, processed_at
      ) VALUES ('sim-failed-1', ?, ?, 'test_orig', NULL, NULL, 100, NULL, 'image/jpeg', 'FAILED', ?, NULL)
    `).run(user1Id, album1Id, new Date().toISOString());

    // Query /photos - should still only be the 2 READY photos!
    const photosRes = await makeRequest('GET', '/photos', {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert.equal(photosRes.body.photos.length, 2);
    for (const p of photosRes.body.photos) {
      assert.equal(p.processing_status, 'READY');
    }

    // Query /albums/:id/photos - should still only be the 2 READY photos!
    const albumRes = await makeRequest('GET', `/albums/${album1Id}/photos`, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert.equal(albumRes.body.photos.length, 2);
  });

  await t.test('6. Album cover update, photo deletion, album deletion & storage cleanup', async () => {
    // Update cover photo to photo2Id
    const updateCoverRes = await makeRequest('PUT', `/albums/${album1Id}`, {
      headers: { Authorization: `Bearer ${user1Token}` },
      body: { cover_photo_id: photo2Id }
    });
    assert.equal(updateCoverRes.status, 200);
    assert.equal(updateCoverRes.body.album.cover_photo_id, photo2Id);

    // Delete photo 1
    const delPhotoRes = await makeRequest('DELETE', `/photos/${photo1Id}`, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert.equal(delPhotoRes.status, 200);

    // Verify photo 1 is gone from DB
    const checkPhotos = await makeRequest('GET', '/photos', {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert.equal(checkPhotos.body.photos.length, 1);
    assert.equal(checkPhotos.body.photos[0].photo_id, photo2Id);

    // Delete Album 1
    const delAlbumRes = await makeRequest('DELETE', `/albums/${album1Id}`, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert.equal(delAlbumRes.status, 200);

    // Verify Album 2 still exists (album deletion must not delete unrelated photos or albums!)
    const remainingAlbums = await makeRequest('GET', '/albums', {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert.equal(remainingAlbums.body.albums.length, 1);
    assert.equal(remainingAlbums.body.albums[0].album_id, album2Id);
  });

  await t.test('7. Upload directly to All Photos when user has no existing album', async () => {
    // User 2 has 0 albums. They upload a photo with no album_id specified.
    const directImg = await sharp({
      create: {
        width: 500,
        height: 500,
        channels: 3,
        background: { r: 100, g: 200, b: 100 }
      }
    }).jpeg().toBuffer();

    const mp = buildMultipart(
      {}, // No album_id!
      [
        { field: 'photos', name: 'direct_all_photos.jpg', type: 'image/jpeg', content: directImg }
      ]
    );

    const directUploadRes = await makeRequest('POST', '/uploads/initiate', {
      headers: {
        Authorization: `Bearer ${user2Token}`,
        ...mp.headers
      },
      body: mp.buffer
    });

    assert.equal(directUploadRes.status, 201);
    assert.equal(directUploadRes.body.photos.length, 1);
    const photo = directUploadRes.body.photos[0];
    assert.equal(photo.processing_status, 'READY');
    assert.equal(photo.album_id, null);

    // Verify User 2 can see it in All Photos
    const u2Photos = await makeRequest('GET', '/photos', {
      headers: { Authorization: `Bearer ${user2Token}` }
    });
    assert.equal(u2Photos.status, 200);
    assert.equal(u2Photos.body.photos.length, 1);
    assert.equal(u2Photos.body.photos[0].photo_id, photo.photo_id);
    assert.equal(u2Photos.body.photos[0].album_name, 'All Photos');
  });

  await t.test('8. ALB Health check endpoint verification', async () => {
    const healthRes = await makeRequest('GET', '/health');
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.body.status, 'ok');
    assert.equal(healthRes.body.service, 'photo-gallery-backend');
    assert.ok(healthRes.body.uptime !== undefined);
  });
});
