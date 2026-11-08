import { Platform } from 'react-native';

const DEFAULT_PORT = '3000';

export function getDefaultApiBaseUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_PORT}`;
  }
  return `http://localhost:${DEFAULT_PORT}`;
}

export let API_BASE_URL = getDefaultApiBaseUrl();

export function setApiBaseUrl(url) {
  if (url) {
    API_BASE_URL = url.replace(/\/+$/, '');
  }
}
