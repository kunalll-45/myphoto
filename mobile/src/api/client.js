import { API_BASE_URL } from './config';

async function request(endpoint, { method = 'GET', token = null, body = null, isFormData = false } = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let fetchBody = body;
  if (body && !isFormData) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: fetchBody
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = data && data.error ? data.error : `Request failed with status ${res.status}`;
      const err = new Error(errorMsg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    console.error(`API Error [${method} ${endpoint}]:`, err.message);
    throw err;
  }
}

export const api = {
  // Auth
  register: (name, email, password) =>
    request('/auth/register', { method: 'POST', body: { name, email, password } }),

  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password } }),

  // Albums
  getAlbums: (token) =>
    request('/albums', { token }),

  createAlbum: (album_name, token) =>
    request('/albums', { method: 'POST', token, body: { album_name } }),

  updateAlbum: (albumId, { album_name, cover_photo_id }, token) =>
    request(`/albums/${albumId}`, { method: 'PUT', token, body: { album_name, cover_photo_id } }),

  deleteAlbum: (albumId, token) =>
    request(`/albums/${albumId}`, { method: 'DELETE', token }),

  getAlbumPhotos: (albumId, token) =>
    request(`/albums/${albumId}/photos`, { token }),

  // Photos
  getAllPhotos: (token) =>
    request('/photos', { token }),

  getPhotoUrl: (photoId, token) =>
    request(`/photos/${photoId}/url`, { token }),

  deletePhoto: (photoId, token) =>
    request(`/photos/${photoId}`, { method: 'DELETE', token }),

  // Uploads
  uploadPhotos: async (albumId, assets, token) => {
    const formData = new FormData();
    formData.append('album_id', albumId);

    assets.forEach((asset, index) => {
      const uri = asset.uri;
      const filename = asset.fileName || uri.split('/').pop() || `photo_${Date.now()}_${index}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1].toLowerCase()}` : `image/jpeg`;

      // On React Native, formData expects { uri, name, type }
      // On web browser, if asset.file is present or we fetch blob:
      if (asset.file) {
        formData.append('photos', asset.file, filename);
      } else {
        formData.append('photos', {
          uri,
          name: filename,
          type
        });
      }
    });

    return request('/uploads/initiate', {
      method: 'POST',
      token,
      body: formData,
      isFormData: true
    });
  },

  // File URL Helper for Images
  getPhotoFileUrl: (photoId, type = 'thumbnail', token = '') => {
    return `${API_BASE_URL}/photos/${photoId}/file?type=${type}&token=${token}`;
  }
};

