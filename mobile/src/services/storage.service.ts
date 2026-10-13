import { Platform } from 'react-native';

const inMemoryFallback = new Map<string, string>();

/**
 * Platform-safe Secure Storage Service
 * - On Native (Android / iOS): Uses expo-secure-store for hardware-backed encrypted storage.
 * - On Web (Development Preview): Uses window.localStorage with an in-memory fallback.
 */
export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Fallback if localStorage is disabled or cookies blocked
    }
    inMemoryFallback.set(key, value);
    return;
  }

  try {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.warn(`SecureStore.setItemAsync failed for key "${key}":`, err);
    inMemoryFallback.set(key, value);
  }
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Fallback
    }
    return inMemoryFallback.get(key) || null;
  }

  try {
    const SecureStore = await import('expo-secure-store');
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.warn(`SecureStore.getItemAsync failed for key "${key}":`, err);
    return inMemoryFallback.get(key) || null;
  }
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {
      // Fallback
    }
    inMemoryFallback.delete(key);
    return;
  }

  try {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    console.warn(`SecureStore.deleteItemAsync failed for key "${key}":`, err);
    inMemoryFallback.delete(key);
  }
}
