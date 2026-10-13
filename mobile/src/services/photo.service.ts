import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as ImageManipulator from 'expo-image-manipulator';

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
  sizeBytes: number;
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  capturedAt: string;
  isMockLocation?: boolean;
  isDevMock?: boolean;
}

/**
 * Requests location permission and acquires GPS coordinates.
 * On Web: uses browser navigator.geolocation with fallback to dev coordinates.
 * On Native (Android/iOS): uses expo-location.
 */
export async function getCurrentGpsLocation(): Promise<{
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  isMockLocation?: boolean;
  isDevMock?: boolean;
}> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracyM: pos.coords.accuracy,
              isMockLocation: false,
              isDevMock: false,
            });
          },
          (_err) => {
            // Web browser denied or localhost without SSL: use DEV mock coordinates
            if (__DEV__) {
              resolve({
                latitude: 28.5355,
                longitude: 77.391,
                accuracyM: 15.0,
                isMockLocation: true,
                isDevMock: true,
              });
            } else {
              resolve({});
            }
          },
          { timeout: 4000 }
        );
      } else if (__DEV__) {
        resolve({
          latitude: 28.5355,
          longitude: 77.391,
          accuracyM: 15.0,
          isMockLocation: true,
          isDevMock: true,
        });
      } else {
        resolve({});
      }
    });
  }

  // Native Android/iOS implementation
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {};
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracyM: loc.coords.accuracy || undefined,
      isMockLocation: loc.mocked || false,
      isDevMock: false,
    };
  } catch (err) {
    console.warn('GPS location fetch warning:', err);
    return {};
  }
}

/**
 * Compresses an image to target ~300KB-600KB.
 * On Web: passes through data URL or blob safely.
 */
export async function compressPhoto(uri: string): Promise<{
  uri: string;
  width: number;
  height: number;
  sizeBytes: number;
}> {
  if (Platform.OS === 'web') {
    return {
      uri,
      width: 1280,
      height: 720,
      sizeBytes: Math.round(uri.length * 0.75) || 350000,
    };
  }

  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    let sizeBytes = 350000;
    try {
      const response = await fetch(result.uri);
      const blob = await response.blob();
      sizeBytes = blob.size;
    } catch {
      // Fallback
    }

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      sizeBytes,
    };
  } catch (err) {
    console.warn('Image compression warning, using original:', err);
    return { uri, width: 1080, height: 1920, sizeBytes: 500000 };
  }
}

/**
 * Generates a DEV-ONLY mock camera photo (active ONLY when Platform.OS === 'web' && __DEV__).
 * Displays a realistic camera capture simulation with stamped timestamp and GPS.
 */
export function generateDevMockPhoto(index: number, timestamp: string): CapturedPhoto {
  if (Platform.OS !== 'web' || !__DEV__) {
    throw new Error('DEV mock photo generator is strictly disabled in production / native builds.');
  }

  // Create an inline SVG data URL representing a live jobsite photo capture
  const colors = ['#1E3A8A', '#065F46', '#78350F', '#4C1D95', '#831843', '#164E63'];
  const bg = colors[index % colors.length];
  const timeFormatted = new Date(timestamp).toLocaleTimeString();

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
      <rect width="600" height="400" fill="${bg}"/>
      <circle cx="300" cy="180" r="80" fill="none" stroke="#FFFFFF" stroke-width="6" opacity="0.4"/>
      <rect x="250" y="150" width="100" height="60" rx="10" fill="#FFFFFF" opacity="0.3"/>
      <text x="300" y="270" font-family="sans-serif" font-size="22" font-weight="bold" fill="#F8FAFC" text-anchor="middle">
        [DEV MOCK LIVE PHOTO #${index + 1}]
      </text>
      <text x="300" y="305" font-family="sans-serif" font-size="14" fill="#FDE047" text-anchor="middle">
        LIVE CAMERA SIMULATION (${timeFormatted})
      </text>
      <rect x="20" y="340" width="560" height="40" rx="6" fill="#000000" opacity="0.7"/>
      <text x="40" y="365" font-family="monospace" font-size="13" fill="#34D399">
        GPS: 28.5355° N, 77.3910° E (Accuracy: ±12m)
      </text>
    </svg>
  `.trim();

  const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;

  return {
    uri,
    width: 600,
    height: 400,
    sizeBytes: 320000,
    latitude: 28.5355,
    longitude: 77.391,
    accuracyM: 12.0,
    capturedAt: timestamp,
    isMockLocation: true,
    isDevMock: true,
  };
}
