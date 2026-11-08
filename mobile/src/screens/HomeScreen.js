import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import PhotoGrid from '../components/PhotoGrid';
import FullScreenViewer from '../components/FullScreenViewer';

export default function HomeScreen({ onNavigateAlbums, onOpenUpload }) {
  const { token } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const loadPhotos = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      const res = await api.getAllPhotos(token);
      // Strictly READY photos are returned by backend
      setPhotos(res.photos || []);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load photos.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const handleSelectPhoto = (photo, index) => {
    setViewerIndex(index);
    setViewerVisible(true);
  };

  const handleDeletePhoto = async (photoId) => {
    try {
      await api.deletePhoto(photoId, token);
      setPhotos((prev) => prev.filter((p) => p.photo_id !== photoId));
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to delete photo.');
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="All Photos"
        subtitle={`${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} • Processed & Ready`}
        rightAction={
          <View style={styles.navActionRow}>
            <TouchableOpacity style={styles.navButton} onPress={onNavigateAlbums}>
              <Text style={styles.navButtonText}>📁 My Albums</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.uploadButton} onPress={() => onOpenUpload(null)}>
              <Text style={styles.uploadButtonText}>+ Upload</Text>
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
          <Text style={styles.loadingText}>Loading all processed photos...</Text>
        </View>
      ) : (
        <PhotoGrid
          photos={photos}
          onSelectPhoto={handleSelectPhoto}
          emptyMessage="No processed photos found. Tap '+ Upload' to select and upload photos into an album."
        />
      )}

      {/* Full-Screen Photo Viewer */}
      <FullScreenViewer
        visible={viewerVisible}
        photos={photos}
        currentIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
        onDeletePhoto={handleDeletePhoto}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  navActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  navButton: {
    backgroundColor: colors.surfaceHover,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  navButtonText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600'
  },
  uploadButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
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

