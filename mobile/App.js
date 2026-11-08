import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Platform
} from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { colors } from './src/theme/colors';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import AlbumsScreen from './src/screens/AlbumsScreen';
import AlbumDetailScreen from './src/screens/AlbumDetailScreen';
import UploadScreen from './src/screens/UploadScreen';

function MainApp() {
  const { user, isLoading } = useAuth();

  // Auth flow state
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'

  // Navigation history stack to allow getting 1 page back from ANY page
  const [history, setHistory] = useState([{ screen: 'photos' }]);
  const [refreshKey, setRefreshKey] = useState(0);

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Not authenticated
  if (!user) {
    if (authMode === 'register') {
      return <RegisterScreen onNavigateLogin={() => setAuthMode('login')} />;
    }
    return <LoginScreen onNavigateRegister={() => setAuthMode('register')} />;
  }

  // Current active navigation frame
  const currentFrame = history[history.length - 1] || { screen: 'photos' };
  const canGoBack = history.length > 1;

  // Push new screen to history stack
  const navigateTo = (newFrame) => {
    setHistory((prev) => [...prev, newFrame]);
  };

  // Step 1 page back in history
  const goBack = () => {
    setHistory((prev) => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, prev.length - 1);
    });
  };

  // Switch root tab
  const switchTab = (tabName) => {
    setHistory([{ screen: tabName }]);
  };

  // Handle opening an album
  const handleOpenAlbum = (album) => {
    navigateTo({ screen: 'album_detail', album });
  };

  // Handle opening upload
  const handleOpenUpload = (albumId = null) => {
    navigateTo({ screen: 'upload', preSelectedAlbumId: albumId });
  };

  // Handle upload complete
  const handleUploadComplete = () => {
    setRefreshKey((prev) => prev + 1);
    goBack();
  };

  // Render current active screen
  const renderCurrentScreen = () => {
    switch (currentFrame.screen) {
      case 'upload':
        return (
          <UploadScreen
            preSelectedAlbumId={currentFrame.preSelectedAlbumId || null}
            onUploadComplete={handleUploadComplete}
            onBack={goBack}
          />
        );

      case 'album_detail':
        return (
          <AlbumDetailScreen
            key={`album-detail-${currentFrame.album.album_id}-${refreshKey}`}
            album={currentFrame.album}
            onBack={goBack}
            onOpenUpload={(albumId) => handleOpenUpload(albumId)}
          />
        );

      case 'albums':
        return (
          <AlbumsScreen
            key={`albums-${refreshKey}`}
            onOpenAlbum={handleOpenAlbum}
            onOpenUpload={handleOpenUpload}
          />
        );

      case 'photos':
      default:
        return (
          <HomeScreen
            key={`home-${refreshKey}`}
            onNavigateAlbums={() => navigateTo({ screen: 'albums' })}
            onOpenUpload={handleOpenUpload}
          />
        );
    }
  };

  const isMainTab = currentFrame.screen === 'photos' || currentFrame.screen === 'albums';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.surface} />

      {/* Global "1 page back" breadcrumb bar when not on root page */}
      {canGoBack ? (
        <View style={styles.historyBar}>
          <TouchableOpacity style={styles.historyBackBtn} onPress={goBack}>
            <Text style={styles.historyBackIcon}>←</Text>
            <Text style={styles.historyBackText}>Back to Previous Page</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.mainContent}>
        {renderCurrentScreen()}
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navTab, currentFrame.screen === 'photos' && styles.navTabActive]}
          onPress={() => switchTab('photos')}
        >
          <Text style={[styles.navTabIcon, currentFrame.screen === 'photos' && styles.navTabTextActive]}>
            🖼️
          </Text>
          <Text style={[styles.navTabText, currentFrame.screen === 'photos' && styles.navTabTextActive]}>
            All Photos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.uploadFloatingBtn}
          onPress={() => handleOpenUpload(currentFrame.album ? currentFrame.album.album_id : null)}
          accessibilityLabel="Upload Photos"
        >
          <Text style={styles.uploadFloatingBtnText}>+</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, currentFrame.screen === 'albums' && styles.navTabActive]}
          onPress={() => switchTab('albums')}
        >
          <Text style={[styles.navTabIcon, currentFrame.screen === 'albums' && styles.navTabTextActive]}>
            📁
          </Text>
          <Text style={[styles.navTabText, currentFrame.screen === 'albums' && styles.navTabTextActive]}>
            My Albums
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center'
  },
  historyBar: {
    backgroundColor: colors.surfaceHover,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center'
  },
  historyBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)'
  },
  historyBackIcon: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700'
  },
  historyBackText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600'
  },
  mainContent: {
    flex: 1
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: Platform.OS === 'web' ? 12 : 8,
    paddingHorizontal: 20,
    position: 'relative'
  },
  navTab: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 16
  },
  navTabActive: {
    opacity: 1
  },
  navTabIcon: {
    fontSize: 20,
    marginBottom: 2
  },
  navTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted
  },
  navTabTextActive: {
    color: colors.primary
  },
  uploadFloatingBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 3,
    borderColor: colors.surface
  },
  uploadFloatingBtnText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 30
  }
});
