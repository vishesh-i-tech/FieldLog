import { Platform } from 'react-native';

/**
 * Application environment configuration
 */

const LOCAL_DEV_IP = '172.20.10.10:4000';

function resolveApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  // Development mode fallback
  if (__DEV__) {
    // When previewing in browser on laptop, talk directly to localhost:4000
    if (Platform.OS === 'web') {
      return 'http://localhost:4000';
    }
    // When running on physical phone over Wi-Fi
    return `http://${LOCAL_DEV_IP}`;
  }

  // Release / Preview builds MUST use secure HTTPS
  throw new Error('FATAL: EXPO_PUBLIC_API_URL must be configured with HTTPS for release builds.');
}

export const DEFAULT_API_BASE_URL = resolveApiBaseUrl();

export const APP_VERSION = '1.0.0';

export interface AppConfig {
  apiBaseUrl: string;
  appVersion: string;
}
