// services/routeTracking.ts — Route Tracking API Service
// Handles all API calls for route session management
// OFFLINE-FIRST: Saves data locally when offline, syncs on manual upload
// NO AUTO-SYNC: All uploads are manual (user presses "Sync Upload")

import { getApiUrl } from '@/constants/config';

// Types
export interface RouteSession {
  id: string;
  orderbookerId: string;
  startTime: string;
  endTime: string | null;
  startLat: number | null;
  startLng: number | null;
  startAddress: string | null;
  endLat: number | null;
  endLng: number | null;
  endAddress: string | null;
  totalDistance: number;
  totalDuration: number | null;
  status: 'active' | 'ended' | 'auto_ended';
  autoEndReason: string | null;
}

export interface ShopProximity {
  shopId: string;
  shopName: string;
  distance: number;
  action: 'entered' | 'exited' | 'nearby' | null;
}

// Internal request helper
async function routeRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getApiUrl()}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Try to get token for authenticated requests
  try {
    const { StorageService } = await import('./storage');
    const token = await StorageService.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {}

  const res = await fetch(url, { headers, ...options });

  // Safely parse JSON — handle non-JSON responses (HTML error pages, etc.)
  let data: any;
  try {
    data = await res.json();
  } catch (parseError) {
    if (!res.ok) {
      throw new Error(`Server unavailable (HTTP ${res.status}). Please try again later.`);
    }
    throw new Error('Unexpected response from server. Please try again later.');
  }

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export const RouteTrackingService = {
  // Start a new route session
  startRoute: async (payload: {
    orderbookerId: string;
    startLat?: number;
    startLng?: number;
    startAddress?: string;
  }): Promise<{ session: RouteSession }> => {
    return routeRequest('/api/route-sessions/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Send a single GPS location
  sendLocation: async (payload: {
    sessionId: string;
    lat: number;
    lng: number;
    accuracy?: number;
    speed?: number;
    altitude?: number;
    batteryLevel?: number;
    isOffline?: boolean;
  }): Promise<{ success: boolean; shopProximity: ShopProximity | null; allProximities: ShopProximity[] }> => {
    return routeRequest('/api/route-sessions/location', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Send batch GPS locations (for offline queue — manual sync upload)
  sendLocationsBatch: async (payload: {
    sessionId: string;
    locations: Array<{
      lat: number;
      lng: number;
      accuracy?: number;
      speed?: number;
      altitude?: number;
      batteryLevel?: number;
      isOffline?: boolean;
      recordedAt?: string;
    }>;
  }): Promise<{ saved: number; shopProximity: ShopProximity[] }> => {
    return routeRequest('/api/route-sessions/locations-batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // End the current route session
  endRoute: async (payload: {
    sessionId: string;
    endLat?: number;
    endLng?: number;
    endAddress?: string;
    autoEndReason?: string;
    status?: 'auto_ended';
  }): Promise<{
    session: RouteSession;
    summary: {
      totalDistance: number;
      totalDuration: number;
      shopsVisited: number;
      locationsCount: number;
    };
  }> => {
    return routeRequest('/api/route-sessions/end', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Get active session for current orderbooker
  getActiveSession: async (orderbookerId: string): Promise<{
    session: RouteSession | null;
    shopVisits: any[];
  }> => {
    return routeRequest(`/api/route-sessions/active?orderbookerId=${orderbookerId}`);
  },

  // Resume an ended route session (same-day only).
  // Re-opens the session — status back to 'active', endTime cleared,
  // shop visits re-opened. Used when orderbooker accidentally ended route.
  resumeRoute: async (sessionId: string): Promise<{ session: RouteSession; resumed: boolean; message?: string }> => {
    return routeRequest('/api/route-sessions/resume', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  },

  // Fetch recovery summary for a specific session — used by route-summary screen
  // Returns only shops that have at least one recovery transaction in the session window.
  getSessionRecoveries: async (sessionId: string, orderbookerId?: string): Promise<{
    sessionId: string;
    orderbookerId: string;
    sessionStartTime: string;
    sessionEndTime: string | null;
    sessionStatus: string;
    totalRecovery: number;
    totalPending: number;
    totalApproved: number;
    totalRejected: number;
    shopsCount: number;
    shops: Array<{
      shopId: string;
      shopName: string;
      shopArea: string | null;
      shopBalance: number;
      totalRecovery: number;
      pendingCount: number;
      approvedCount: number;
      rejectedCount: number;
      entries: Array<{
        id: string;
        amount: number;
        status: 'pending' | 'approved' | 'rejected';
        description?: string | null;
        gpsLat?: number | null;
        gpsLng?: number | null;
        gpsAddress?: string | null;
        createdAt: string;
        createdBy: string;
        createdByName?: string | null;
        approvedBy?: string | null;
        approvedByName?: string | null;
        approvedAt?: string | null;
        rejectReason?: string | null;
        isEditable: boolean;
      }>;
    }>;
  }> => {
    const qs = orderbookerId ? `?orderbookerId=${encodeURIComponent(orderbookerId)}` : '';
    return routeRequest(`/api/route-sessions/${encodeURIComponent(sessionId)}/recoveries${qs}`);
  },
};
