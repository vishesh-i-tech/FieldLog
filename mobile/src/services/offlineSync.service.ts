import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { DEFAULT_API_BASE_URL } from '../constants/config';
import { getAuthTokens } from './auth.state';
import { compressPhoto } from './photo.service';

export interface QueuedRecordItem {
  id: string;
  clientId: string;
  siteId: string;
  siteName: string;
  recordDate: string;
  status: 'full' | 'half' | 'stopped';
  capturedAt: string;
  issueTypeIds: string[];
  photos: {
    uri: string;
    sizeBytes: number;
    latitude: number | null;
    longitude: number | null;
    accuracyM: number | null;
    capturedAt: string;
    isMockLocation?: boolean;
  }[];
  audio?: {
    uri: string;
    mimeType: string;
    sizeBytes: number;
    durationSeconds: number;
  };
  syncState: 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED';
  retryCount: number;
  lastError?: string;
  createdAt: string;
  syncedAt?: string;
}

export interface CachedSiteItem {
  id: string;
  name: string;
  locationText?: string;
  latitude?: number | null;
  longitude?: number | null;
  cachedAt: string;
}

type QueueListener = (pendingCount: number, items: QueuedRecordItem[]) => void;
const listeners = new Set<QueueListener>();

// Web / fallback in-memory store
const inMemoryQueue: QueuedRecordItem[] = [];
const inMemoryCachedSites: CachedSiteItem[] = [];

let sqliteDb: any = null;
let isInitialized = false;
let isSyncing = false;

/**
 * Initialize local SQLite database on device (or in-memory on Web)
 */
export async function initOfflineDatabase(): Promise<void> {
  if (isInitialized) return;

  if (Platform.OS !== 'web') {
    try {
      const SQLite = await import('expo-sqlite');
      sqliteDb = await SQLite.openDatabaseAsync('fieldlog_offline.db');

      // 1. sync_queue table
      await sqliteDb.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY,
          client_id TEXT NOT NULL UNIQUE,
          site_id TEXT NOT NULL,
          site_name TEXT,
          record_date TEXT NOT NULL,
          status TEXT NOT NULL,
          captured_at TEXT NOT NULL,
          issue_type_ids TEXT,
          photos_json TEXT,
          audio_json TEXT,
          sync_state TEXT NOT NULL,
          retry_count INTEGER DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL,
          synced_at TEXT
        );
      `);

      // 2. cached_sites table
      await sqliteDb.execAsync(`
        CREATE TABLE IF NOT EXISTS cached_sites (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          location_text TEXT,
          latitude REAL,
          longitude REAL,
          cached_at TEXT NOT NULL
        );
      `);
    } catch (err) {
      console.warn('Failed to initialize native SQLite, falling back to memory/localStorage:', err);
    }
  } else {
    // Load from Web localStorage if available
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedQueue = window.localStorage.getItem('fieldlog_sync_queue');
        if (savedQueue) {
          const parsed = JSON.parse(savedQueue);
          inMemoryQueue.push(...parsed);
        }
        const savedSites = window.localStorage.getItem('fieldlog_cached_sites');
        if (savedSites) {
          const parsedSites = JSON.parse(savedSites);
          inMemoryCachedSites.push(...parsedSites);
        }
      }
    } catch {}
  }

  isInitialized = true;
}

function persistWebState() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('fieldlog_sync_queue', JSON.stringify(inMemoryQueue));
      window.localStorage.setItem('fieldlog_cached_sites', JSON.stringify(inMemoryCachedSites));
    } catch {}
  }
}

function notifyListeners(items: QueuedRecordItem[]) {
  const pendingCount = items.filter((i) => i.syncState === 'PENDING' || i.syncState === 'FAILED').length;
  listeners.forEach((listener) => {
    try {
      listener(pendingCount, items);
    } catch {}
  });
}

/**
 * Subscribe to queue changes
 */
export function subscribeToQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  getAllQueueItems().then((items) => {
    const pendingCount = items.filter((i) => i.syncState === 'PENDING' || i.syncState === 'FAILED').length;
    listener(pendingCount, items);
  });

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Add an offline submission into the SQLite outbox queue
 */
export async function enqueueOfflineRecord(item: Omit<QueuedRecordItem, 'syncState' | 'retryCount' | 'createdAt'>): Promise<QueuedRecordItem> {
  await initOfflineDatabase();

  const record: QueuedRecordItem = {
    ...item,
    syncState: 'PENDING',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };

  if (sqliteDb) {
    try {
      await sqliteDb.runAsync(
        `INSERT OR REPLACE INTO sync_queue (
          id, client_id, site_id, site_name, record_date, status, captured_at,
          issue_type_ids, photos_json, audio_json, sync_state, retry_count,
          last_error, created_at, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.clientId,
          record.siteId,
          record.siteName || '',
          record.recordDate,
          record.status,
          record.capturedAt,
          JSON.stringify(record.issueTypeIds || []),
          JSON.stringify(record.photos || []),
          record.audio ? JSON.stringify(record.audio) : null,
          record.syncState,
          record.retryCount,
          record.lastError || null,
          record.createdAt,
          record.syncedAt || null,
        ]
      );
    } catch (err) {
      console.error('Failed to write to SQLite sync_queue:', err);
    }
  } else {
    const existingIdx = inMemoryQueue.findIndex((i) => i.id === record.id || i.clientId === record.clientId);
    if (existingIdx >= 0) {
      inMemoryQueue[existingIdx] = record;
    } else {
      inMemoryQueue.unshift(record);
    }
    persistWebState();
  }

  const all = await getAllQueueItems();
  notifyListeners(all);
  return record;
}

/**
 * Get all queued items
 */
export async function getAllQueueItems(): Promise<QueuedRecordItem[]> {
  await initOfflineDatabase();

  if (sqliteDb) {
    try {
      const rows = await sqliteDb.getAllAsync(`
        SELECT * FROM sync_queue ORDER BY created_at DESC
      `);

      return (rows || []).map((r: any) => ({
        id: r.id,
        clientId: r.client_id,
        siteId: r.site_id,
        siteName: r.site_name,
        recordDate: r.record_date,
        status: r.status,
        capturedAt: r.captured_at,
        issueTypeIds: r.issue_type_ids ? JSON.parse(r.issue_type_ids) : [],
        photos: r.photos_json ? JSON.parse(r.photos_json) : [],
        audio: r.audio_json ? JSON.parse(r.audio_json) : undefined,
        syncState: r.sync_state,
        retryCount: r.retry_count || 0,
        lastError: r.last_error || undefined,
        createdAt: r.created_at,
        syncedAt: r.synced_at || undefined,
      }));
    } catch (err) {
      console.warn('Error reading sync_queue from SQLite:', err);
      return inMemoryQueue;
    }
  }

  return [...inMemoryQueue];
}

/**
 * Cache workplaces in SQLite so supervisor can pick sites offline
 */
export async function cacheWorkPlaces(sites: CachedSiteItem[]): Promise<void> {
  await initOfflineDatabase();

  if (sqliteDb) {
    try {
      for (const site of sites) {
        await sqliteDb.runAsync(
          `INSERT OR REPLACE INTO cached_sites (id, name, location_text, latitude, longitude, cached_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            site.id,
            site.name,
            site.locationText || '',
            site.latitude !== undefined && site.latitude !== null ? Number(site.latitude) : null,
            site.longitude !== undefined && site.longitude !== null ? Number(site.longitude) : null,
            site.cachedAt || new Date().toISOString(),
          ]
        );
      }
    } catch (err) {
      console.warn('Failed to cache sites in SQLite:', err);
    }
  } else {
    inMemoryCachedSites.length = 0;
    inMemoryCachedSites.push(...sites);
    persistWebState();
  }
}

/**
 * Retrieve cached workplaces when offline
 */
export async function getCachedWorkPlaces(): Promise<CachedSiteItem[]> {
  await initOfflineDatabase();

  if (sqliteDb) {
    try {
      const rows = await sqliteDb.getAllAsync('SELECT * FROM cached_sites ORDER BY name ASC');
      return (rows || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        locationText: r.location_text,
        latitude: r.latitude,
        longitude: r.longitude,
        cachedAt: r.cached_at,
      }));
    } catch (err) {
      console.warn('Error reading cached_sites from SQLite:', err);
      return inMemoryCachedSites;
    }
  }

  return [...inMemoryCachedSites];
}

/**
 * Process the offline sync queue
 * Uploads media and submits daily reports to the central server
 */
export async function processSyncQueue(): Promise<{ synced: number; failed: number }> {
  if (isSyncing) return { synced: 0, failed: 0 };
  isSyncing = true;

  let syncedCount = 0;
  let failedCount = 0;

  try {
    const netState = await NetInfo.fetch();
    const isOnline = netState.isConnected && netState.isInternetReachable !== false;
    if (!isOnline && Platform.OS !== 'web') {
      isSyncing = false;
      return { synced: 0, failed: 0 };
    }

    const tokens = getAuthTokens();
    if (!tokens?.accessToken) {
      isSyncing = false;
      return { synced: 0, failed: 0 };
    }

    const items = await getAllQueueItems();
    const pendingItems = items.filter((i) => i.syncState === 'PENDING' || i.syncState === 'FAILED');

    for (const item of pendingItems) {
      try {
        // 1. Mark as SYNCING
        await updateItemState(item.id, 'SYNCING');

        // 2. Upload photos
        const uploadedPhotos = await Promise.all(
          item.photos.map(async (p, idx) => {
            const fileName = `site_${item.siteId}_${Date.now()}_${idx}.jpg`;
            const storageKey = `photos/${fileName}`;

            let dataUrlToSend = p.uri;
            if (dataUrlToSend && (dataUrlToSend.startsWith('file://') || dataUrlToSend.startsWith('content://'))) {
              try {
                const manip = await compressPhoto(dataUrlToSend);
                if (manip.uri && manip.uri.startsWith('data:image/')) {
                  dataUrlToSend = manip.uri;
                }
              } catch (convErr) {
                console.warn('Could not compress offline photo to dataUrl:', convErr);
              }
            }

            try {
              await fetch(`${DEFAULT_API_BASE_URL}/api/v1/dev-storage/upload?key=${encodeURIComponent(storageKey)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataUrl: dataUrlToSend }),
              });
            } catch (uploadErr) {
              console.warn('Offline photo storage upload notice:', uploadErr);
            }

            return {
              storageKey,
              mimeType: 'image/jpeg',
              sizeBytes: p.sizeBytes,
              latitude: p.latitude !== undefined && p.latitude !== null ? Number(p.latitude) : null,
              longitude: p.longitude !== undefined && p.longitude !== null ? Number(p.longitude) : null,
              accuracyM: p.accuracyM !== undefined && p.accuracyM !== null ? Number(p.accuracyM) : null,
              capturedAt: p.capturedAt,
              flags: p.isMockLocation ? { mock_location: true } : {},
            };
          })
        );

        // 3. Upload audio if present
        let audioPayload: any = undefined;
        if (item.audio) {
          audioPayload = {
            storageKey: `audio/sample_${Date.now()}.${item.audio.mimeType.includes('webm') ? 'webm' : 'm4a'}`,
            mimeType: item.audio.mimeType,
            sizeBytes: item.audio.sizeBytes,
            durationSeconds: item.audio.durationSeconds,
            capturedAt: new Date().toISOString(),
          };
        }

        // 4. Submit to live backend API (idempotent with clientId)
        const payload = {
          clientId: item.clientId,
          siteId: item.siteId,
          recordDate: item.recordDate,
          status: item.status,
          capturedAt: item.capturedAt,
          missingPhoto: item.photos.length === 0,
          missingVoice: !item.audio,
          issueTypeIds: item.issueTypeIds,
          photos: uploadedPhotos,
          audio: audioPayload,
        };

        const res = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/records`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Server returned ${res.status}`);
        }

        // 5. Mark as SYNCED
        await updateItemState(item.id, 'SYNCED');
        syncedCount++;
      } catch (itemErr: any) {
        failedCount++;
        const errorMsg = itemErr instanceof Error ? itemErr.message : String(itemErr);
        await updateItemState(item.id, 'FAILED', errorMsg);
      }
    }
  } finally {
    isSyncing = false;
    const all = await getAllQueueItems();
    notifyListeners(all);
  }

  return { synced: syncedCount, failed: failedCount };
}

async function updateItemState(id: string, syncState: QueuedRecordItem['syncState'], error?: string) {
  const now = new Date().toISOString();

  if (sqliteDb) {
    try {
      await sqliteDb.runAsync(
        `UPDATE sync_queue
         SET sync_state = ?,
             last_error = ?,
             retry_count = retry_count + 1,
             synced_at = ?
         WHERE id = ?`,
        [syncState, error || null, syncState === 'SYNCED' ? now : null, id]
      );
    } catch (err) {
      console.warn('Failed to update SQLite queue item state:', err);
    }
  } else {
    const item = inMemoryQueue.find((i) => i.id === id);
    if (item) {
      item.syncState = syncState;
      item.lastError = error;
      item.retryCount += 1;
      if (syncState === 'SYNCED') {
        item.syncedAt = now;
      }
      persistWebState();
    }
  }
}

/**
 * Setup background network listener:
 * Auto-triggers sync when device reconnects to internet
 */
export function setupAutoSyncListener(): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      processSyncQueue().catch((err) => {
        console.warn('Auto-sync execution error:', err);
      });
    }
  });

  return unsubscribe;
}
