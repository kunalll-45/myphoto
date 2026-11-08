import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import CreateAlbumModal from './CreateAlbumModal';

export default function UploadScreen({ preSelectedAlbumId = null, onUploadComplete, onBack }) {
  const { token } = useAuth();
  const [albums, setAlbums] = useState([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState(preSelectedAlbumId); // null means All Photos (no album)
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);

  useEffect(() => {
    async function fetchAlbums() {
      try {
        const res = await api.getAlbums(token);
        setAlbums(res.albums || []);
        // If user provided preSelectedAlbumId, keep it; otherwise default to preSelected or null
        if (preSelectedAlbumId) {
          setSelectedAlbumId(preSelectedAlbumId);
        }
      } catch (err) {
        setErrorMessage('Failed to load albums for selection.');
      }
    }
    fetchAlbums();
  }, [token, preSelectedAlbumId]);

  const handlePickImages = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Camera roll permission is required to select photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
        selectionLimit: 20
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedAssets((prev) => [...prev, ...result.assets]);
        setErrorMessage('');
      }
    } catch (err) {
      console.error('Pick image error:', err);
      setErrorMessage('Failed to select photos from device.');
    }
  };

  const handleRemoveAsset = (indexToRemove) => {
    setSelectedAssets((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleStartUpload = async () => {
    if (selectedAssets.length === 0) {
      setErrorMessage('Please select at least one photo to upload.');
      return;
    }

    try {
      setIsUploading(true);
      setErrorMessage('');
      setUploadStatusText(`Uploading ${selectedAssets.length} photo(s)...`);

      // Upload to incoming storage & trigger processing (selectedAlbumId can be null for All Photos)
      setUploadStatusText('Storing in incoming storage and triggering image processor...');
      const res = await api.uploadPhotos(selectedAlbumId, selectedAssets, token);

      setUploadStatusText('Compression and thumbnails complete! Status: READY');

      setTimeout(() => {
        setIsUploading(false);
        onUploadComplete(res.photos || []);
      }, 700);

    } catch (err) {
      console.error('Upload failure:', err);
      setErrorMessage(err.message || 'Photo upload and processing failed.');
      setIsUploading(false);
      setUploadStatusText('');
    }
  };

  const handleAlbumCreated = (newAlbum) => {
    setAlbums((prev) => [newAlbum, ...prev]);
    setSelectedAlbumId(newAlbum.album_id);
  };

  return (
    <View style={styles.container}>
      <Header
        title="Upload Photos"
        subtitle={selectedAlbumId ? "Uploading to selected album" : "Uploading directly to All Photos"}
        rightAction={
          <TouchableOpacity style={styles.backButton} onPress={onBack} disabled={isUploading}>
            <Text style={styles.backButtonText}>‹ Back</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* 1. Destination Album Picker */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>1. Destination</Text>
            <TouchableOpacity
              style={styles.quickCreateBtn}
              onPress={() => setCreateModalVisible(true)}
              disabled={isUploading}
            >
              <Text style={styles.quickCreateBtnText}>+ New Album</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumRow}>
            {/* Always allow uploading directly to All Photos */}
            <TouchableOpacity
              style={[styles.albumPill, selectedAlbumId === null && styles.albumPillActive]}
              onPress={() => setSelectedAlbumId(null)}
              disabled={isUploading}
            >
              <Text style={[styles.albumPillText, selectedAlbumId === null && styles.albumPillTextActive]}>
                🖼️ All Photos (No Album)
              </Text>
            </TouchableOpacity>

            {albums.map((album) => {
              const isSelected = album.album_id === selectedAlbumId;
              return (
                <TouchableOpacity
                  key={album.album_id}
                  style={[styles.albumPill, isSelected && styles.albumPillActive]}
                  onPress={() => setSelectedAlbumId(album.album_id)}
                  disabled={isUploading}
                >
                  <Text style={[styles.albumPillText, isSelected && styles.albumPillTextActive]}>
                    📁 {album.album_name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {albums.length === 0 ? (
            <Text style={styles.helperText}>
              No custom albums yet — photos will be saved directly to All Photos.
            </Text>
          ) : null}
        </View>

        {/* 2. Photo Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              2. Selected Photos ({selectedAssets.length})
            </Text>
            <TouchableOpacity
              style={styles.addPhotosBtn}
              onPress={handlePickImages}
              disabled={isUploading}
            >
              <Text style={styles.addPhotosBtnText}>+ Choose Photos</Text>
            </TouchableOpacity>
          </View>

          {selectedAssets.length === 0 ? (
            <TouchableOpacity
              style={styles.uploadDropzone}
              onPress={handlePickImages}
              disabled={isUploading}
            >
              <Text style={styles.dropzoneIcon}>📸</Text>
              <Text style={styles.dropzoneTitle}>No photos chosen</Text>
              <Text style={styles.dropzoneText}>
                Tap here to select one or multiple photos from your device
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.previewsGrid}>
              {selectedAssets.map((asset, index) => (
                <View key={index} style={styles.previewCard}>
                  <Image source={{ uri: asset.uri }} style={styles.previewImage} resizeMode="cover" />
                  {!isUploading ? (
                    <TouchableOpacity
                      style={styles.removeBadge}
                      onPress={() => handleRemoveAsset(index)}
                    >
                      <Text style={styles.removeBadgeText}>✕</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 3. Progress and Upload Trigger */}
        {isUploading ? (
          <View style={styles.progressCard}>
            <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 12 }} />
            <Text style={styles.progressStatus}>{uploadStatusText}</Text>
            <Text style={styles.progressSubtext}>
              Workflow: Storing incoming → Compressing → Generating Thumbnails → Setting Status READY
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.submitButton,
              selectedAssets.length === 0 && styles.submitButtonDisabled
            ]}
            onPress={handleStartUpload}
            disabled={selectedAssets.length === 0}
          >
            <Text style={styles.submitButtonText}>
              Upload & Process {selectedAssets.length > 0 ? `(${selectedAssets.length})` : ''}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Quick Create Album Modal */}
      <CreateAlbumModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onAlbumCreated={handleAlbumCreated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  backButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border
  },
  backButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  content: {
    padding: 20,
    paddingBottom: 60,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center'
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '500'
  },
  section: {
    marginBottom: 28
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text
  },
  quickCreateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border
  },
  quickCreateBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600'
  },
  albumRow: {
    flexDirection: 'row',
    paddingVertical: 4
  },
  albumPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 10
  },
  albumPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  albumPillText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600'
  },
  albumPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  helperText: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 8
  },
  addPhotosBtn: {
    backgroundColor: colors.surfaceHover,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  addPhotosBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700'
  },
  uploadDropzone: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dropzoneIcon: {
    fontSize: 36,
    marginBottom: 10
  },
  dropzoneTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4
  },
  dropzoneText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center'
  },
  previewsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  previewCard: {
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.surfaceHover
  },
  previewImage: {
    width: '100%',
    height: '100%'
  },
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  removeBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800'
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  },
  submitButtonDisabled: {
    opacity: 0.5
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
  },
  progressCard: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: 10
  },
  progressStatus: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6
  },
  progressSubtext: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18
  }
});
