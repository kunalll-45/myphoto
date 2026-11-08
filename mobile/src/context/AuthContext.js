import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';

const AuthContext = createContext(null);

const STORAGE_KEY_TOKEN = '@photo_gallery_token';
const STORAGE_KEY_USER = '@photo_gallery_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStorageAuth() {
      try {
        const storedToken = await AsyncStorage.getItem(STORAGE_KEY_TOKEN);
        const storedUser = await AsyncStorage.getItem(STORAGE_KEY_USER);

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (err) {
        console.error('Failed to load auth from storage:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadStorageAuth();
  }, []);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    setToken(res.token);
    setUser(res.user);
    await AsyncStorage.setItem(STORAGE_KEY_TOKEN, res.token);
    await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(res.user));
    return res;
  };

  const register = async (name, email, password) => {
    const res = await api.register(name, email, password);
    setToken(res.token);
    setUser(res.user);
    await AsyncStorage.setItem(STORAGE_KEY_TOKEN, res.token);
    await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(res.user));
    return res;
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEY_USER);
    } catch (e) {}
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

