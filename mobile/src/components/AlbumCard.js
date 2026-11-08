import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function AlbumCard({ album, onOpen, onRename, onDelete }) {
  const { token } = useAuth();

  const coverUrl = album.cover_photo_id
    ? api.getPhotoFileUrl(album.cover_photo_id, 'thumbnail', token)
    : null;

  return (
    <View style={styles.card}>
      <TouchableOpacity activeOpacity={0.85} style={styles.coverContainer} onPress={onOpen}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.placeholderIcon}>📁</Text>
            <Text style={styles.placeholderText}>Empty Album</Text>
          </View>
        )}
        <View style={styles.photoCountBadge}>
          <Text style={styles.photoCountText}>
            {album.photo_count} {album.photo_count === 1 ? 'photo' : 'photos'}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.infoContainer}>
        <TouchableOpacity style={styles.titleArea} onPress={onOpen}>
          <Text style={styles.albumName} numberOfLines={1}>
            {album.album_name}
          </Text>
          <Text style={styles.createdDate}>
            Created {new Date(album.created_at).toLocaleDateString()}
          </Text>
        </TouchableOpacity>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={onRename}>
            <Text style={styles.actionButtonText}>Rename</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={onDelete}>
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    overflow: 'hidden'
  },
  coverContainer: {
    height: 180,
    backgroundColor: colors.surfaceHover,
    position: 'relative'
  },
  coverImage: {
    width: '100%',
    height: '100%'
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHover
  },
  placeholderIcon: {
    fontSize: 40,
    marginBottom: 8
  },
  placeholderText: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600'
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(11, 15, 23, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  photoCountText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600'
  },
  infoContainer: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  titleArea: {
    flex: 1,
    marginRight: 12
  },
  albumName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4
  },
  createdDate: {
    fontSize: 12,
    color: colors.textDim
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border
  },
  actionButtonText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600'
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)'
  },
  deleteButtonText: {
    color: colors.danger
  }
});

