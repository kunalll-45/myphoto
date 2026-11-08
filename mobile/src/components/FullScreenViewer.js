import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Platform,
  Alert
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function FullScreenViewer({
  visible,
  photos = [],
  currentIndex = 0,
  currentAlbum = null,
  onClose,
  onDeletePhoto,
  onSetCoverPhoto
}) {
  const { token } = useAuth();
  const [index, setIndex] = useState(currentIndex);
  const [zoomScale, setZoomScale] = useState(1);

  // Sync index when currentIndex prop changes
  React.useEffect(() => {
    setIndex(currentIndex);
    setZoomScale(1);
  }, [currentIndex, visible]);

  if (!visible || !photos || photos.length === 0) {
    return null;
  }

  const currentPhoto = photos[index] || photos[0];
  const photoUrl = api.getPhotoFileUrl(currentPhoto.photo_id, 'processed', token);

  const handlePrev = () => {
    if (index > 0) {
      setIndex(index - 1);
      setZoomScale(1);
    }
  };

  const handleNext = () => {
    if (index < photos.length - 1) {
      setIndex(index + 1);
      setZoomScale(1);
    }
  };

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(prev + 0.5, 3.5));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(prev - 0.5, 1));
  };

  const handleResetZoom = () => {
    setZoomScale(1);
  };

  const confirmDelete = () => {
    const doDelete = () => {
      onDeletePhoto(currentPhoto.photo_id);
      if (photos.length <= 1) {
        onClose();
      } else if (index >= photos.length - 1) {
        setIndex(Math.max(0, index - 1));
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this photo? This will delete the photo and its files.')) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Photo',
        'Are you sure you want to delete this photo and its stored files?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete }
        ]
      );
    }
  };

  const handleSetCover = () => {
    if (onSetCoverPhoto) {
      onSetCoverPhoto(currentPhoto.photo_id);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeContainer}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.iconButton} onPress={onClose} accessibilityLabel="Close full screen">
              <Text style={styles.iconButtonText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.counterContainer}>
              <Text style={styles.counterText}>
                {index + 1} / {photos.length}
              </Text>
              {currentPhoto.album_name ? (
                <Text style={styles.albumSubtitle} numberOfLines={1}>
                  {currentPhoto.album_name}
                </Text>
              ) : null}
            </View>

            <View style={styles.topRightActions}>
              {currentAlbum && onSetCoverPhoto ? (
                <TouchableOpacity
                  style={[
                    styles.coverActionButton,
                    currentAlbum.cover_photo_id === currentPhoto.photo_id && styles.activeCoverBadge
                  ]}
                  onPress={handleSetCover}
                >
                  <Text style={styles.coverActionText}>
                    {currentAlbum.cover_photo_id === currentPhoto.photo_id ? '★ Cover' : 'Make Cover'}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {onDeletePhoto ? (
                <TouchableOpacity style={[styles.iconButton, styles.deleteButton]} onPress={confirmDelete} accessibilityLabel="Delete photo">
                  <Text style={styles.deleteButtonText}>🗑</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Photo Display with Zoom Container */}
          <View style={styles.imageViewerContainer}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              maximumZoomScale={3.5}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
            >
              <Image
                source={{ uri: photoUrl }}
                style={[
                  styles.image,
                  {
                    transform: [{ scale: zoomScale }]
                  }
                ]}
                resizeMode="contain"
              />
            </ScrollView>

            {/* Left Nav Button */}
            {index > 0 ? (
              <TouchableOpacity style={[styles.navArrow, styles.navArrowLeft]} onPress={handlePrev}>
                <Text style={styles.navArrowText}>‹</Text>
              </TouchableOpacity>
            ) : null}

            {/* Right Nav Button */}
            {index < photos.length - 1 ? (
              <TouchableOpacity style={[styles.navArrow, styles.navArrowRight]} onPress={handleNext}>
                <Text style={styles.navArrowText}>›</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Bottom Controls Bar */}
          <View style={styles.bottomBar}>
            <View style={styles.zoomControls}>
              <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut} disabled={zoomScale <= 1}>
                <Text style={[styles.zoomText, zoomScale <= 1 && styles.disabledText]}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.zoomButton} onPress={handleResetZoom}>
                <Text style={styles.zoomLevelText}>{Math.round(zoomScale * 100)}%</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn} disabled={zoomScale >= 3.5}>
                <Text style={[styles.zoomText, zoomScale >= 3.5 && styles.disabledText]}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.photoMeta}>
              <Text style={styles.metaText}>
                {currentPhoto.processed_size
                  ? `${Math.round(currentPhoto.processed_size / 1024)} KB`
                  : ''}
              </Text>
              <Text style={styles.metaDate}>
                {new Date(currentPhoto.uploaded_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 12, 0.98)'
  },
  safeContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)'
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700'
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)'
  },
  deleteButtonText: {
    fontSize: 16
  },
  counterContainer: {
    alignItems: 'center'
  },
  counterText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700'
  },
  albumSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  coverActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  activeCoverBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    borderColor: colors.primary
  },
  coverActionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600'
  },
  imageViewerContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%'
  },
  image: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.75
  },
  navArrow: {
    position: 'absolute',
    top: '46%',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(21, 29, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10
  },
  navArrowLeft: {
    left: 14
  },
  navArrowRight: {
    right: 14
  },
  navArrowText: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '300'
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)'
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  zoomButton: {
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  zoomText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700'
  },
  zoomLevelText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600'
  },
  disabledText: {
    color: colors.textDim
  },
  photoMeta: {
    alignItems: 'flex-end'
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500'
  },
  metaDate: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2
  }
});

