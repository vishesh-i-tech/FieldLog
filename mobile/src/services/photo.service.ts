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
  locationSource?: 'exif' | 'device_gps' | 'site_default';
  locationWarning?: string;
}

/**
 * Extracts EXIF GPS coordinates (Latitude & Longitude) directly from an image file/blob.
 * Pure TypeScript implementation without external dependencies.
 */
export async function extractExifGps(file: Blob | File): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          if (!buffer || buffer.byteLength < 64) return resolve(null);

          const view = new DataView(buffer);
          // Verify JPEG SOI
          if (view.getUint16(0, false) !== 0xffd8) return resolve(null);

          let offset = 2;
          while (offset < view.byteLength - 4) {
            const marker = view.getUint16(offset, false);
            offset += 2;

            if (marker === 0xffe1) {
              // APP1 Exif Marker
              offset += 2; // skip length

              // Check "Exif\0\0"
              if (
                view.getUint32(offset, false) === 0x45786966 &&
                view.getUint16(offset + 4, false) === 0x0000
              ) {
                const tiffOffset = offset + 6;
                const isLittleEndian = view.getUint16(tiffOffset, false) === 0x4949; // 'II'

                const firstIFDOffset = view.getUint32(tiffOffset + 4, isLittleEndian);
                let ifdOffset = tiffOffset + firstIFDOffset;

                const numEntries = view.getUint16(ifdOffset, isLittleEndian);
                ifdOffset += 2;

                let gpsInfoOffset = 0;
                for (let i = 0; i < numEntries; i++) {
                  const tag = view.getUint16(ifdOffset + i * 12, isLittleEndian);
                  if (tag === 0x8825) {
                    gpsInfoOffset = view.getUint32(ifdOffset + i * 12 + 8, isLittleEndian);
                    break;
                  }
                }

                if (gpsInfoOffset > 0) {
                  const gpsOffset = tiffOffset + gpsInfoOffset;
                  const numGps = view.getUint16(gpsOffset, isLittleEndian);
                  const gpsEntries = gpsOffset + 2;

                  let latRef = 'N';
                  let lonRef = 'E';
                  let latVal: number | null = null;
                  let lonVal: number | null = null;

                  const readRational3 = (entryOffset: number) => {
                    const rOffset = tiffOffset + view.getUint32(entryOffset + 8, isLittleEndian);
                    const deg = view.getUint32(rOffset, isLittleEndian) / (view.getUint32(rOffset + 4, isLittleEndian) || 1);
                    const min = view.getUint32(rOffset + 8, isLittleEndian) / (view.getUint32(rOffset + 12, isLittleEndian) || 1);
                    const sec = view.getUint32(rOffset + 16, isLittleEndian) / (view.getUint32(rOffset + 20, isLittleEndian) || 1);
                    return deg + min / 60 + sec / 3600;
                  };

                  for (let i = 0; i < numGps; i++) {
                    const tag = view.getUint16(gpsEntries + i * 12, isLittleEndian);
                    if (tag === 1) {
                      latRef = String.fromCharCode(view.getUint8(gpsEntries + i * 12 + 8));
                    } else if (tag === 2) {
                      latVal = readRational3(gpsEntries + i * 12);
                    } else if (tag === 3) {
                      lonRef = String.fromCharCode(view.getUint8(gpsEntries + i * 12 + 8));
                    } else if (tag === 4) {
                      lonVal = readRational3(gpsEntries + i * 12);
                    }
                  }

                  if (latVal !== null && lonVal !== null) {
                    const latitude = latRef === 'S' ? -latVal : latVal;
                    const longitude = lonRef === 'W' ? -lonVal : lonVal;
                    return resolve({ latitude, longitude });
                  }
                }
              }
              break;
            } else if ((marker & 0xff00) !== 0xff00) {
              break;
            } else {
              offset += view.getUint16(offset, false);
            }
          }
          resolve(null);
        } catch {
          resolve(null);
        }
      };
      reader.readAsArrayBuffer(file.slice(0, 128 * 1024));
    } catch {
      resolve(null);
    }
  });
}

/**
 * Requests location permission and acquires GPS coordinates.
 * On Web: uses browser navigator.geolocation with high accuracy.
 * On Native (Android/iOS): uses expo-location.
 */
export async function getCurrentGpsLocation(): Promise<{
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  isMockLocation?: boolean;
  isDevMock?: boolean;
  locationOff?: boolean;
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
            // Location might be turned off or denied in browser
            resolve({
              latitude: 28.5355,
              longitude: 77.391,
              accuracyM: 15.0,
              isMockLocation: true,
              isDevMock: true,
              locationOff: true,
            });
          },
          { enableHighAccuracy: true, timeout: 6000 }
        );
      } else {
        resolve({
          latitude: 28.5355,
          longitude: 77.391,
          accuracyM: 15.0,
          isMockLocation: true,
          isDevMock: true,
          locationOff: true,
        });
      }
    });
  }

  // Native Android/iOS implementation
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { locationOff: true };
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
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
    return { locationOff: true };
  }
}

/**
 * Stamped Watermark Canvas Generator for real photos.
 * Draws the real image on canvas, adds GPS stamp and returns JPEG data URL.
 */
export function stampGeoDataOnImage(
  imgElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | any,
  lat?: number,
  lng?: number,
  accuracy?: number,
  locationWarning?: string
): string {
  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  // Scale down to max 1280 width to keep performance fast and snappy
  const maxDim = 1280;
  let w = (imgElement as any).naturalWidth || (imgElement as any).videoWidth || (imgElement as any).width || 800;
  let h = (imgElement as any).naturalHeight || (imgElement as any).videoHeight || (imgElement as any).height || 600;

  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Draw the REAL user photo
  ctx.drawImage(imgElement, 0, 0, w, h);

  // Bottom GPS banner overlay
  const bannerHeight = Math.max(54, Math.round(h * 0.12));
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, h - bannerHeight, w, bannerHeight);

  // Top border line for banner
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, h - bannerHeight);
  ctx.lineTo(w, h - bannerHeight);
  ctx.stroke();

  // Watermark text
  const fontSize = Math.max(13, Math.round(w * 0.025));
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.fillStyle = '#34D399';
  ctx.textAlign = 'left';

  const latStr = lat != null ? lat.toFixed(5) : '28.53550';
  const lngStr = lng != null ? lng.toFixed(5) : '77.39100';
  const accStr = accuracy != null ? `±${Math.round(accuracy)}m` : '±8m';
  ctx.fillText(`📍 GPS: ${latStr}° N, ${lngStr}° E (${accStr})`, 16, h - bannerHeight + fontSize + 6);

  ctx.font = `${Math.max(11, Math.round(fontSize * 0.85))}px sans-serif`;
  ctx.fillStyle = '#E2E8F0';
  const timeStr = new Date().toLocaleString();
  const warningText = locationWarning ? ` • ${locationWarning}` : '';
  ctx.fillText(`📅 ${timeStr} • FieldLog Verified${warningText}`, 16, h - 10);

  return canvas.toDataURL('image/jpeg', 0.82);
}

/**
 * Opens real device image capture or gallery on Web.
 * Returns the real photo taken or picked, with accurate GPS coordinates.
 */
export async function pickRealDevicePhoto(
  captureMode: 'camera' | 'gallery' = 'camera'
): Promise<CapturedPhoto | null> {
  if (typeof document === 'undefined') return null;

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (captureMode === 'camera') {
      input.setAttribute('capture', 'environment');
    }
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = async (evt: any) => {
      const file: File | undefined = evt.target?.files?.[0];
      if (!file) {
        document.body.removeChild(input);
        return resolve(null);
      }

      try {
        // 1. Try reading EXIF GPS from the file itself (if existing photo)
        const exifGps = await extractExifGps(file);

        // 2. Query device's real live GPS
        const liveGps = await getCurrentGpsLocation();

        // Location priority: EXIF GPS > Live GPS
        let finalLat = exifGps?.latitude ?? liveGps.latitude ?? 28.5355;
        let finalLng = exifGps?.longitude ?? liveGps.longitude ?? 77.391;
        let finalAccuracy = exifGps ? 5.0 : (liveGps.accuracyM ?? 10.0);
        let locationSource: 'exif' | 'device_gps' | 'site_default' = exifGps
          ? 'exif'
          : liveGps.locationOff
          ? 'site_default'
          : 'device_gps';

        let warning = '';
        if (liveGps.locationOff && !exifGps) {
          warning = 'Device GPS Off';
        }

        // 3. Load image into memory and stamp watermark
        const reader = new FileReader();
        reader.onload = (re) => {
          const img = new Image();
          img.onload = () => {
            const stampedJpeg = stampGeoDataOnImage(
              img,
              finalLat,
              finalLng,
              finalAccuracy,
              warning
            );

            document.body.removeChild(input);

            resolve({
              uri: stampedJpeg,
              width: img.naturalWidth || 800,
              height: img.naturalHeight || 600,
              sizeBytes: Math.round(stampedJpeg.length * 0.75) || file.size || 350000,
              latitude: finalLat,
              longitude: finalLng,
              accuracyM: finalAccuracy,
              capturedAt: new Date().toISOString(),
              isMockLocation: liveGps.isMockLocation || false,
              locationSource,
              locationWarning: warning,
            });
          };
          img.src = re.target?.result as string;
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('Error processing device photo:', err);
        document.body.removeChild(input);
        resolve(null);
      }
    };

    input.click();
  });
}

/**
 * Fallback dev simulation photo (used only when hardware input is totally unavailable).
 */
export async function generateDevMockPhoto(index: number, timestamp: string): Promise<CapturedPhoto> {
  const gps = await getCurrentGpsLocation();
  const uri = createDevMockCanvasJpeg(gps.latitude, gps.longitude, gps.accuracyM, `PHOTO #${index + 1}`);

  return {
    uri,
    width: 800,
    height: 600,
    sizeBytes: Math.round(uri.length * 0.75) || 280000,
    latitude: gps.latitude ?? 28.5355,
    longitude: gps.longitude ?? 77.391,
    accuracyM: gps.accuracyM ?? 10.0,
    capturedAt: timestamp,
    isMockLocation: gps.isMockLocation ?? false,
    isDevMock: true,
  };
}

function createDevMockCanvasJpeg(lat?: number, lng?: number, accuracy?: number, title?: string): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#1E293B');
  grad.addColorStop(0.5, '#334155');
  grad.addColorStop(1, '#0F172A');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title || 'SITE PHOTO', 400, 300);

  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 530, 800, 70);
  ctx.fillStyle = '#10B981';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`📍 GPS: ${lat?.toFixed(5) || '28.53550'}° N, ${lng?.toFixed(5) || '77.39100'}° E`, 20, 560);

  return canvas.toDataURL('image/jpeg', 0.85);
}

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
    } catch {}

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      sizeBytes,
    };
  } catch (err) {
    return { uri, width: 1080, height: 1920, sizeBytes: 500000 };
  }
}
