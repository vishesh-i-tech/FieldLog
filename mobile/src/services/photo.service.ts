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
}

/**
 * Requests location permission and acquires current GPS coordinates.
 */
export async function getCurrentGpsLocation(): Promise<{
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  isMockLocation?: boolean;
}> {
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
    };
  } catch (err) {
    console.warn('GPS location fetch warning:', err);
    return {};
  }
}

/**
 * Compresses an image to target ~300KB-600KB and extracts dimensions.
 */
export async function compressPhoto(uri: string): Promise<{ uri: string; width: number; height: number; sizeBytes: number }> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }], // Standard high-clarity 720p/1080p mobile width
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Approximate size or fetch size
    let sizeBytes = 350000; // ~350 KB estimate
    try {
      const response = await fetch(result.uri);
      const blob = await response.blob();
      sizeBytes = blob.size;
    } catch {
      // Fallback to estimate if blob inspection unavailable
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
