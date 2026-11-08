import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions, useWindowDimensions, FlatList } from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function PhotoGrid({ photos = [], onSelectPhoto, emptyMessage = 'No photos available.' }) {
  const { token } = useAuth();
  const { width } = useWindowDimensions();

  // Responsive column calculation (min 3 columns, scalable for wider web screens)
  const numColumns = width > 900 ? 5 : width > 600 ? 4 : 3;
  const spacing = 4;
  const itemSize = (width - (numColumns + 1) * spacing) / numColumns;

  if (!photos || photos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Text style={styles.emptyIconText}>📷</Text>
        </View>
        <Text style={styles.emptyTitle}>No Photos Found</Text>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  const renderItem = ({ item, index }) => {
    const imageUrl = api.getPhotoFileUrl(item.photo_id, 'thumbnail', token);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.photoCard, { width: itemSize, height: itemSize }]}
        onPress={() => onSelectPhoto(item, index)}
      >
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
        {item.album_name ? (
          <View style={styles.albumTag}>
            <Text style={styles.albumTagText} numberOfLines={1}>
              {item.album_name}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      key={`grid-${numColumns}`}
      data={photos}
      renderItem={renderItem}
      keyExtractor={(item) => item.photo_id}
      numColumns={numColumns}
      contentContainerStyle={[styles.gridContainer, { padding: spacing }]}
      columnWrapperStyle={numColumns > 1 ? { gap: spacing, marginBottom: spacing } : null}
    />
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    paddingBottom: 40
  },
  photoCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative'
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceHover
  },
  albumTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(11, 15, 23, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  albumTagText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600'
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    minHeight: 300
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  emptyIconText: {
    fontSize: 28
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280
  }
});

