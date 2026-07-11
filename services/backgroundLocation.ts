// services/backgroundLocation.ts — GPS Location Tracking Service
// Uses expo-location's watchPositionAsync() for foreground GPS tracking
// Works WITHOUT expo-task-manager — no crash risk!
//
// OFFLINE-FIRST DESIGN (No Auto-Sync):
// - GPS locations are ALWAYS saved to AsyncStorage (survive app kills)
// - NO auto-sync when internet returns — all data stays local
// - Data is uploaded ONLY when user presses "Sync Upload" button
// - Max 2000 locations stored locally (~16 hours at 30s intervals = full working day)
//
// BEHAVIOR:
// - App foreground: GPS updates every 30 seconds ✅
// - App minimized: GPS pauses, resumes when app returns ✅
// - App killed: Offline locations saved in AsyncStorage, restored on next launch ✅
// - Net OFF → Net ON: NO auto-sync — data stays local until manual upload ✅

const LOCATION_INTERVAL_MS = 15000; // 15 seconds (was 30s — reduced for better waypoints)
const LOCATION_DISTANCE_M = 10; // minimum 10 meters between updates
const MAX_OFFLINE_LOCATIONS = 2000; // max stored locally (~16 hours at 30s intervals = full working day)

// ── Queue for offline locations ────────────────────────────────────
interface QueuedLocation {
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  altitude: number | null;
  batteryLevel: number | null;
  isOffline: boolean;
  recordedAt: string;
}

let locationQueue: QueuedLocation[] = [];

// ── Active watch subscription ──────────────────────────────────────
let _watchSubscription: { remove: () => void } | null = null;
let _isWatching = false;

// ── Lazy-load modules ──────────────────────────────────────────────
let _Location: typeof import('expo-location') | null = null;

async function getLocationModule() {
  if (!_Location) {
    try {
      _Location = require('expo-location');
    } catch (e) {
      console.error('[GPS] Failed to load expo-location:', e);
      return null;
    }
  }
  return _Location;
}

async function getStorageService() {
  try {
    const mod = require('./storage');
    return mod.StorageService;
  } catch (e) {
    console.error('[GPS] Failed to load StorageService:', e);
    return null;
  }
}

// ── AsyncStorage persistence for GPS locations ────────────────────
// ALL locations are always persisted locally — no auto-sync to server

async function persistOfflineLocations() {
  try {
    const Storage = await getStorageService();
    if (!Storage || locationQueue.length === 0) return;

    await Storage.addOfflineRouteLocations(locationQueue);
    console.log(`[GPS] Persisted ${locationQueue.length} locations to AsyncStorage`);
  } catch (e) {
    console.error('[GPS] Failed to persist locations:', e);
  }
}

async function loadPersistedLocations() {
  try {
    const Storage = await getStorageService();
    if (!Storage) return;

    const persisted = await Storage.getOfflineRouteLocations();
    if (persisted.length > 0) {
      locationQueue = persisted;
      console.log(`[GPS] Loaded ${persisted.length} persisted locations from AsyncStorage`);
    }
  } catch (e) {
    console.error('[GPS] Failed to load persisted locations:', e);
  }
}

async function clearPersistedLocations() {
  try {
    const Storage = await getStorageService();
    if (Storage) await Storage.clearOfflineRouteLocations();
  } catch {}
}

// ── Online GPS sender ──────────────────────────────────────────────
// When internet is available AND session is a server session (not local_),
// send each GPS point to the server in real-time for live tracking on website.
// ALWAYS saves locally first regardless of network status.
let _lastSendTime = 0;
const SEND_INTERVAL_MS = 30000; // Send to server every 30 seconds at most

async function trySendLocationToServer(
  sessionId: string,
  locationData: QueuedLocation
): Promise<void> {
  // Only send if session is a real server session (not local_)
  if (sessionId.startsWith('local_')) return;

  // Throttle sends to avoid hammering the server
  const now = Date.now();
  if (now - _lastSendTime < SEND_INTERVAL_MS) return;

  try {
    const { getApiUrl } = require('../constants/config');
    const apiUrl = getApiUrl();
    if (!apiUrl) return;

    // Try to get auth token
    const Storage = await getStorageService();
    const token = Storage ? await Storage.getToken() : null;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(`${apiUrl}/api/route-sessions/location`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sessionId,
        lat: locationData.lat,
        lng: locationData.lng,
        accuracy: locationData.accuracy,
        speed: locationData.speed,
        altitude: locationData.altitude,
        batteryLevel: locationData.batteryLevel,
        isOffline: false, // Real-time send means it's online
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      _lastSendTime = now;
      console.log('[GPS] Location sent to server (real-time)');
    } else {
      console.warn('[GPS] Server rejected location:', response.status);
    }
  } catch (e: any) {
    // Network error — that's fine, data is saved locally
    // Will be uploaded on manual sync
    if (e.name !== 'AbortError') {
      console.warn('[GPS] Real-time send failed (will retry on sync):', e.message);
    }
  }
}

// ── Handle each GPS location update ────────────────────────────────
// ALWAYS saves locally first, then tries to send to server if online
async function handleLocationUpdate(coords: {
  latitude: number;
  longitude: number;
  accuracy: number | null | undefined;
  speed: number | null | undefined;
  altitude: number | null | undefined;
}, timestamp: number) {
  try {
    const Storage = await getStorageService();
    const sessionId = Storage ? await Storage.getRouteSessionId() : null;

    if (!sessionId) {
      console.warn('[GPS] No active session ID, skipping location');
      return;
    }

    const locationData: QueuedLocation = {
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy ?? null,
      speed: coords.speed ?? null,
      altitude: coords.altitude ?? null,
      batteryLevel: null,
      isOffline: true, // Mark as offline initially — will be marked online if sent in real-time
      recordedAt: new Date(timestamp).toISOString(),
    };

    // Add to local queue
    locationQueue.push(locationData);

    // Keep queue size manageable
    if (locationQueue.length > MAX_OFFLINE_LOCATIONS) {
      locationQueue = locationQueue.slice(-MAX_OFFLINE_LOCATIONS);
    }

    // Persist ONLY the new location (not entire queue — avoids duplicates in storage)
    try {
      const Storage = await getStorageService();
      if (Storage) {
        await Storage.addOfflineRouteLocations([locationData]);
      }
    } catch (e) {
      console.error('[GPS] Failed to persist location:', e);
    }

    console.log(`[GPS] Location saved locally (${locationQueue.length} total queued)`);

    // Try to send to server in real-time (non-blocking — don't await)
    // This enables live tracking on the website
    trySendLocationToServer(sessionId, locationData).catch(() => {});
  } catch (error) {
    console.error('[GPS] handleLocationUpdate error:', error);
  }
}

// ── Start foreground GPS tracking using watchPositionAsync ─────────
export async function startBackgroundLocationTracking(): Promise<boolean> {
  try {
    // If already watching, don't start again
    if (_isWatching && _watchSubscription) {
      console.log('[GPS] Already watching');
      return true;
    }

    const Location = await getLocationModule();
    if (!Location) return false;

    // Request foreground permission
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.error('[GPS] Foreground permission denied');
      return false;
    }

    // Try to get background permission too (for future task-manager upgrade)
    try {
      await Location.requestBackgroundPermissionsAsync();
    } catch {
      // Not critical — we use foreground tracking
    }

    // Load any persisted offline locations from previous session
    await loadPersistedLocations();

    // Start watching position — this works in foreground WITHOUT task-manager
    _watchSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: LOCATION_INTERVAL_MS,
        distanceInterval: LOCATION_DISTANCE_M,
      },
      (location) => {
        handleLocationUpdate(location.coords, location.timestamp);
      }
    );

    _isWatching = true;
    console.log('[GPS] watchPositionAsync started — tracking every 30s (offline-first, no auto-sync)');

    return true;
  } catch (error) {
    console.error('[GPS] Failed to start:', error);
    _isWatching = false;
    return false;
  }
}

// ── Stop GPS tracking ──────────────────────────────────────────────
export async function stopBackgroundLocationTracking(): Promise<void> {
  try {
    // Stop the watch subscription
    if (_watchSubscription) {
      _watchSubscription.remove();
      _watchSubscription = null;
    }
    _isWatching = false;

    // Persist any remaining locations
    if (locationQueue.length > 0) {
      await persistOfflineLocations();
    }

    console.log('[GPS] Stopped — locations saved locally for manual sync');
  } catch (error) {
    console.error('[GPS] Failed to stop:', error);
  }
}

// ── Check if tracking is running ───────────────────────────────────
export async function isBackgroundLocationRunning(): Promise<boolean> {
  return _isWatching;
}

// ── Get current location once (for start/end of route) ─────────────
export async function getCurrentLocation(): Promise<{
  lat: number;
  lng: number;
  accuracy: number | null;
  address?: string;
} | null> {
  try {
    const Location = await getLocationModule();
    if (!Location) return null;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    let address: string | undefined;
    try {
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (geo) {
        address = [geo.name, geo.street, geo.city, geo.region].filter(Boolean).join(', ');
      }
    } catch {}

    return {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? null,
      address,
    };
  } catch (error) {
    console.error('[GPS] getCurrentLocation failed:', error);
    return null;
  }
}

// ── Get ALL queued locations for manual sync upload ────────────────
// Called when user presses "Sync Upload" button
export async function getQueuedLocations(): Promise<QueuedLocation[]> {
  // First load any persisted from AsyncStorage
  await loadPersistedLocations();
  return [...locationQueue];
}

// ── Clear all queued locations after successful sync upload ─────────
export async function clearQueuedLocations(): Promise<void> {
  locationQueue = [];
  await clearPersistedLocations();
  console.log('[GPS] All queued locations cleared after sync');
}

// ── Resume tracking after app comes back to foreground ──────────────
export async function resumeTrackingIfNeeded(): Promise<boolean> {
  try {
    const Storage = await getStorageService();
    const sessionId = Storage ? await Storage.getRouteSessionId() : null;

    if (!sessionId) return false; // No active route

    if (_isWatching) {
      // Already watching — just load any new persisted locations
      await loadPersistedLocations();
      return true;
    }

    // Restart the watch (it may have been paused/lost when app was backgrounded)
    return await startBackgroundLocationTracking();
  } catch (error) {
    console.error('[GPS] resumeTrackingIfNeeded failed:', error);
    return false;
  }
}

// ── Get count of offline locations (for UI display) ────────────────
export function getOfflineLocationCount(): number {
  return locationQueue.length;
}

// ── Flush offline locations (DEPRECATED — kept for compatibility) ──
// This is now a no-op — data is only uploaded on manual sync
export async function flushOfflineLocations(_sessionId?: string): Promise<void> {
  // No-op: Data stays local until manual sync upload
  console.log('[GPS] flushOfflineLocations called — no-op (manual sync only)');
}
