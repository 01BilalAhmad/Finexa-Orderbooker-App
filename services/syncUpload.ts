// services/syncUpload.ts — Comprehensive Sync Upload Service
// Called when user presses "Sync Upload" button after ending route
// Uploads: Route Session + GPS Waypoints + Transactions + Shop Visits

import { StorageService } from './storage';
import { RouteTrackingService } from './routeTracking';
import { ApiService } from './api';
import { syncOfflineRecoveries, resetSyncLock } from './offlineSync';
import { getApiUrl } from '@/constants/config';

export interface SyncUploadResult {
  success: boolean;
  routeUploaded: boolean;
  locationsUploaded: number;
  transactionsSynced: number;
  transactionsFailed: number;
  visitsRecorded: number;
  error?: string;
}

/**
 * Full sync upload — called when user presses "Sync Upload" button
 * Upload order matters:
 * 1. Route Session Start (if offline/local session)
 * 2. GPS Waypoints (batch)
 * 3. Route Session End
 * 4. Offline Transactions (recoveries)
 * 5. Shop Visits
 */
export async function performSyncUpload(): Promise<SyncUploadResult> {
  const result: SyncUploadResult = {
    success: false,
    routeUploaded: false,
    locationsUploaded: 0,
    transactionsSynced: 0,
    transactionsFailed: 0,
    visitsRecorded: 0,
  };

  try {
    // Step 1: Handle offline route start
    const startInfo = await StorageService.getRouteStartInfo();
    let serverSessionId: string | null = null;

    if (startInfo && startInfo.sessionId.startsWith('local_')) {
      try {
        const res = await RouteTrackingService.startRoute({
          orderbookerId: startInfo.orderbookerId,
          startLat: startInfo.startLat,
          startLng: startInfo.startLng,
          startAddress: startInfo.startAddress,
        });
        serverSessionId = res.session.id;
        result.routeUploaded = true;
        await StorageService.clearRouteStartInfo();
        console.log('[SyncUpload] Route start synced, server session:', serverSessionId);
      } catch (e: any) {
        console.error('[SyncUpload] Route start sync failed:', e.message);
        result.error = 'Route start sync failed: ' + e.message;
        // Don't return early — still try to upload transactions and visits
        // GPS waypoints will be retried on next sync when route start succeeds
      }
    }

    // Step 2: Upload GPS waypoints
    const { getQueuedLocations, clearQueuedLocations } = await import('./backgroundLocation');
    const locations = await getQueuedLocations();

    if (locations.length > 0) {
      // Determine sessionId: prefer server session, then local
      const sessionId = serverSessionId || (await StorageService.getRouteSessionId());

      if (sessionId) {
        // If sessionId is local, we need to upload using the route start info instead
        // The locations will be associated with the session created in step 1
        const effectiveSessionId = sessionId.startsWith('local_') && startInfo ? serverSessionId : sessionId;
        
        if (effectiveSessionId && !effectiveSessionId.startsWith('local_')) {
          try {
            // Send in batches of 500 (API limit)
            for (let i = 0; i < locations.length; i += 500) {
              const batch = locations.slice(i, i + 500);
              await RouteTrackingService.sendLocationsBatch({
                sessionId: effectiveSessionId,
                locations: batch,
              });
              result.locationsUploaded += batch.length;
            }
            await clearQueuedLocations();
            console.log(`[SyncUpload] Uploaded ${result.locationsUploaded} GPS waypoints`);
          } catch (e: any) {
            console.error('[SyncUpload] GPS waypoints upload failed:', e.message);
            result.error = 'GPS upload failed: ' + e.message;
            // Continue with other uploads even if GPS fails
          }
        } else {
          console.warn('[SyncUpload] No valid server session ID for GPS upload — locations preserved for next sync');
          // Don't clear locations — they'll be uploaded when session is properly synced
        }
      } else {
        console.warn('[SyncUpload] No session ID available for GPS upload');
      }
    }

    // Step 3: Handle route end
    const endInfo = await StorageService.getRouteEndInfo();
    if (endInfo) {
      const sessionId = serverSessionId || endInfo.sessionId;
      if (sessionId && !sessionId.startsWith('local_')) {
        try {
          await RouteTrackingService.endRoute({
            sessionId,
            endLat: endInfo.endLat,
            endLng: endInfo.endLng,
            endAddress: endInfo.endAddress,
          });
          await StorageService.clearRouteEndInfo();
          console.log('[SyncUpload] Route end synced');
        } catch (e: any) {
          console.error('[SyncUpload] Route end sync failed:', e.message);
        }
      }
    }

    // Step 4: Sync offline transactions (recoveries)
    try {
      resetSyncLock();
      const syncResult = await syncOfflineRecoveries();
      result.transactionsSynced = syncResult.synced;
      result.transactionsFailed = syncResult.failed;
      console.log(`[SyncUpload] Synced ${syncResult.synced} transactions, ${syncResult.failed} failed`);
    } catch (e: any) {
      console.error('[SyncUpload] Transaction sync failed:', e.message);
    }

    // Step 5: Sync offline phone updates
    try {
      const updates = await StorageService.getOfflinePhoneUpdates();
      for (const update of updates) {
        try {
          await ApiService.updateShopPhone(update.shopId, update.phone, update.ownerName);
          await StorageService.removeOfflinePhoneUpdate(update.shopId);
        } catch {}
      }
    } catch {}

    // Step 6: Sync offline SMS logs (queued while OB was offline)
    try {
      const pendingSmsLogs = await StorageService.getOfflineSmsLogs();
      if (pendingSmsLogs.length > 0) {
        console.log(`[SyncUpload] Syncing ${pendingSmsLogs.length} pending SMS logs...`);
        const syncedIds: string[] = [];
        for (const log of pendingSmsLogs) {
          try {
            await ApiService.logSms({
              shopId: log.shopId,
              shopName: log.shopName,
              shopPhone: log.shopPhone,
              orderbookerId: log.orderbookerId,
              transactionId: log.transactionId,
              method: log.method,
              status: log.status,
              message: log.message,
              errorMessage: log.errorMessage,
            });
            syncedIds.push(log.id);
          } catch (e: any) {
            console.warn(`[SyncUpload] SMS log sync failed for ${log.id}:`, e?.message);
          }
        }
        if (syncedIds.length > 0) {
          await StorageService.removeFromOfflineSmsLogs(syncedIds);
          console.log(`[SyncUpload] Synced ${syncedIds.length} SMS logs to server`);
        }
      }
    } catch (smsSyncErr: any) {
      console.warn('[SyncUpload] SMS log sync failed (non-blocking):', smsSyncErr?.message);
    }

    // Mark sync upload date
    const today = new Date().toISOString().split('T')[0];
    await StorageService.saveLastSyncUploadDate(today);

    result.success = true;
    return result;
  } catch (error: any) {
    result.error = error.message || 'Sync upload failed';
    console.error('[SyncUpload] Fatal error:', error);
    return result;
  }
}

/**
 * Check if 10 PM auto-end should trigger
 * Returns true if current time is past 10 PM and route is still active
 */
export function shouldAutoEndRoute(): boolean {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 22; // 10 PM or later
}

/**
 * Check if 8 PM reminder should trigger
 */
export function shouldShowReminder(): boolean {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 20 && hour < 22; // Between 8 PM and 10 PM
}
