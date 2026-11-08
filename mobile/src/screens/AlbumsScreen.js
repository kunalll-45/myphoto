import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  Modal
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import AlbumCard from '../components/AlbumCard';
import CreateAlbumModal from './CreateAlbumModal';

export default function AlbumsScreen({ onOpenAlbum, onOpenUpload }) {
  const { token } = useAuth();
  const [albums, setAlbums] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Create album modal
  const [createModalVisible, setCreateModalVisible] = useState(false);

  // Rename album modal
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [albumToRename, setAlbumToRename] = useState(null);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const loadAlbums = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      const res = await api.getAlbums(token);
      setAlbums(res.albums || []);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load albums.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  const handleStartRename = (album) => {
    setAlbumToRename(album);
    setNewAlbumName(album.album_name);
    setRenameModalVisible(true);
  };

  const handleConfirmRename = async () => {
    if (!newAlbumName.trim() || !albumToRename) return;

    try {
      setIsRenaming(true);
      const res = await api.updateAlbum(albumToRename.album_id, { album_name: newAlbumName.trim() }, token);
      setAlbums((prev) =>
        prev.map((a) => (a.album_id === albumToRename.album_id ? res.album : a))
      );
      setRenameModalVisible(false);
      setAlbumToRename(null);
    } catch (err) {
      Alert.alert('Rename Failed', err.message || 'Could not rename album.');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteAlbum = (album) => {
    const doDelete = async () => {
      try {
        await api.deleteAlbum(album.album_id, token);
        setAlbums((prev) => prev.filter((a) => a.album_id !== album.album_id));
      } catch (err) {
        Alert.alert('Delete Failed', err.message || 'Could not delete album.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${album.album_name}"? All photos in this album will also be deleted.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Album',
        `Are you sure you want to delete "${album.album_name}"? All photos belonging to this album will also be deleted.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete }
        ]
      );
    }
  };

  const handleAlbumCreated = (newAlbum) => {
    setAlbums((prev) => [newAlbum, ...prev]);
  };

  return (
    <View style={styles.container}>
      <Header
        title="My Albums"
        subtitle={`${albums.length} ${albums.length === 1 ? 'album' : 'albums'} created`}
        rightAction={
          <TouchableOpacity
            style={styles.newAlbumButton}
            onPress={() => setCreateModalVisible(true)}
          >
            <Text style={styles.newAlbumButtonText}>+ New Album</Text>
          </TouchableOpacity>
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
          <Text style={styles.loadingText}>Loading your albums...</Text>
        </View>
      ) : albums.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📁</Text>
          <Text style={styles.emptyTitle}>No Albums Yet</Text>
          <Text style={styles.emptyText}>Create an album to organize your uploaded photos.</Text>
          <TouchableOpacity
            style={styles.emptyCreateButton}
            onPress={() => setCreateModalVisible(true)}
          >
            <Text style={styles.emptyCreateButtonText}>+ Create First Album</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={albums}
          keyExtractor={(item) => item.album_id}
          renderItem={({ item }) => (
            <AlbumCard
              album={item}
              onOpen={() => onOpenAlbum(item)}
              onRename={() => handleStartRename(item)}
              onDelete={() => handleDeleteAlbum(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Create Album Modal */}
      <CreateAlbumModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onAlbumCreated={handleAlbumCreated}
      />

      {/* Rename Album Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.renameCard}>
            <Text style={styles.modalTitle}>Rename Album</Text>
            <TextInput
              style={styles.renameInput}
              value={newAlbumName}
              onChangeText={setNewAlbumName}
              placeholder="Album name"
              placeholderTextColor={colors.textDim}
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRenameModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, isRenaming && { opacity: 0.6 }]}
                onPress={handleConfirmRename}
                disabled={isRenaming}
              >
                <Text style={styles.modalSaveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  newAlbumButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8
  },
  newAlbumButtonText: {
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
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center'
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280
  },
  emptyCreateButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10
  },
  emptyCreateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  renameCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    width: '100%',
    maxWidth: 380
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16
  },
  renameInput: {
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
    marginBottom: 18
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: colors.surfaceHover
  },
  modalCancelBtnText: {
    color: colors.textMuted,
    fontWeight: '600'
  },
  modalSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: colors.primary
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700'
  }
});

