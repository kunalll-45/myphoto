import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import PhotoGrid from '../components/PhotoGrid';
import FullScreenViewer from '../components/FullScreenViewer';

export default function AlbumDetailScreen({ album, onBack, onOpenUpload }) {
  const { token } = useAuth();
  const [currentAlbum, setCurrentAlbum] = useState(album);
  const [photos, setPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Full-screen viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const loadAlbumData = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      const res = await api.getAlbumPhotos(album.album_id, token);
      setCurrentAlbum(res.album || album);
      setPhotos(res.photos || []);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load album photos.');
    } finally {
      setIsLoading(false);
    }
  }, [album.album_id, token]);

  useEffect(() => {
    loadAlbumData();
  }, [loadAlbumData]);

  const handleSelectPhoto = (photo, index) => {
    setViewerIndex(index);
    setViewerVisible(true);
  };

  const handleDeletePhoto = async (photoId) => {
    try {
      await api.deletePhoto(photoId, token);
      setPhotos((prev) => prev.filter((p) => p.photo_id !== photoId));
      const res = await api.getAlbumPhotos(album.album_id, token);
      setCurrentAlbum(res.album);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to delete photo.');
    }
  };

  const handleSetCoverPhoto = async (photoId) => {
    try {
      const res = await api.updateAlbum(currentAlbum.album_id, { cover_photo_id: photoId }, token);
      setCurrentAlbum(res.album);
      if (Platform.OS === 'web') {
        alert('Album cover updated successfully!');
      } else {
        Alert.alert('Success', 'Album cover photo updated!');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update cover photo.');
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title={currentAlbum.album_name}
        subtitle={`${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} • READY`}
        rightAction={
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back to albums">
              <Text style={styles.backBtnText}>‹ Back to Albums</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={() => onOpenUpload(currentAlbum.album_id)}
            >
              <Text style={styles.uploadBtnText}>+ Add Photos</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading album photos...</Text>
        </View>
      ) : (
        <PhotoGrid
          photos={photos}
          onSelectPhoto={handleSelectPhoto}
          emptyMessage="No photos in this album yet. Tap '+ Add Photos' above to upload."
        />
      )}

      {/* Full-Screen Photo Viewer */}
      <FullScreenViewer
        visible={viewerVisible}
        photos={photos}
        currentIndex={viewerIndex}
        currentAlbum={currentAlbum}
        onClose={() => setViewerVisible(false)}
        onDeletePhoto={handleDeletePhoto}
        onSetCoverPhoto={handleSetCoverPhoto}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border
  },
  backBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  uploadBtn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    margin: 16,
    padding: 12,
    borderRadius: 10
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center'
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: 12,
    fontSize: 14
  }
});
