import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

export default function Header({ title, subtitle, rightAction }) {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.left}>
          <Text style={styles.brandTitle}>PHOTO VAULT</Text>
          <Text style={styles.screenTitle}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.right}>
          {rightAction ? rightAction : null}

          {user ? (
            <TouchableOpacity style={styles.userBadge} onPress={logout} accessibilityLabel="Log out">
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: Platform.OS === 'web' ? 16 : 12
  },
  left: {
    flex: 1
  },
  brandTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.5,
    marginBottom: 2
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHover,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  logoutText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500'
  }
});

