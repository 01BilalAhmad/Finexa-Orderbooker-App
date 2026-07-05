// contexts/RouteTrackingContext.tsx — Route Session Management
// Handles start/end route, foreground GPS tracking, and session state
// Includes 8 PM reminder and 10 PM auto-end

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, Component } from 'react';
import { AppState, Alert } from 'react-native';
import { StorageService } from '@/services/storage';
import { useAuth } from '@/hooks/useAuth';

// ── Types ──────────────────────────────────────────────────────────
interface RouteSession {
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

interface ShopProximity {
  shopId: string;
  shopName: string;
  distance: number;
  action: 'entered' | 'exited' | 'nearby' | null;
}

interface RouteTrackingState {
  isTracking: boolean;
  sessionId: string | null;
  session: RouteSession | null;
  startTime: string | null;
  lastProximity: ShopProximity | null;
  isStarting: boolean;
  isStopping: boolean;
  error: string | null;
}

interface RouteTrackingContextType extends RouteTrackingState {
  startRoute: () => Promise<void>;
  endRoute: () => Promise<void>;
  resumeRoute: () => Promise<void>;
  isResuming: boolean;
  lastEndedSessionId: string | null;
  clearError: () => void;
}

const initialState: RouteTrackingState = {
  isTracking: false,
  sessionId: null,
  session: null,
  startTime: null,
  lastProximity: null,
  isStarting: false,
  isStopping: false,
  error: null,
};

const RouteTrackingContext = createContext<RouteTrackingContextType>({
  ...initialState,
  isResuming: false,
  lastEndedSessionId: null,
  startRoute: async () => {},
  endRoute: async () => {},
  resumeRoute: async () => {},
  clearError: () => {},
});

export function useRouteTracking() {
  return useContext(RouteTrackingContext);
}

// ── Lazy-loaded modules ─────────────────────────────────────────
let _RouteTrackingService: any = null;
let _backgroundLocation: any = null;

async function getRouteTrackingService() {
  if (!_RouteTrackingService) {
    try {
      const mod = await import('@/services/routeTracking');
      _RouteTrackingService = mod.RouteTrackingService;
    } catch (e) {
      console.error('[RouteTracking] Failed to load RouteTrackingService:', e);
      return null;
    }
  }
  return _RouteTrackingService;
}

async function getBackgroundLocation() {
  if (!_backgroundLocation) {
    try {
      _backgroundLocation = await import('@/services/backgroundLocation');
    } catch (e) {
      console.error('[RouteTracking] Failed to load backgroundLocation:', e);
      return null;
    }
  }
  return _backgroundLocation;
}

// ── Error Boundary ─────────────────────────────────────────────────
class RouteTrackingErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[RouteTracking] ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.children;
    }
    return this.props.children;
  }
}

// ── Provider ───────────────────────────────────────────────────────
function RouteTrackingProviderInner({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RouteTrackingState>(initialState);
  const [isResuming, setIsResuming] = useState(false);
  const [lastEndedSessionId, setLastEndedSessionId] = useState<string | null>(null);
  const { user } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const prevUserRef = useRef<string | null>(null);
  const reminderShownRef = useRef(false); // Track if 8 PM reminder was shown today
  const endRouteRef = useRef<() => Promise<void>>(async () => {}); // Ref to avoid stale closure in timer

  // On mount, check if there's a resumable (ended today) session so the UI can show the summary
  useEffect(() => {
    (async () => {
      try {
        const resumableId = await StorageService.getResumableSessionId();
        if (resumableId) setLastEndedSessionId(resumableId);
      } catch {}
    })();
  }, []);

  // Cleanup route tracking on logout
  useEffect(() => {
    if (prevUserRef.current && !user) {
      (async () => {
        try {
          const bg = await getBackgroundLocation();
          if (bg) await bg.stopBackgroundLocationTracking();
        } catch {}
        try {
          await StorageService.clearLastEndedSession();
        } catch {}
      })();
      sessionIdRef.current = null;
      setState(initialState);
      setLastEndedSessionId(null);
      reminderShownRef.current = false;
    }
    prevUserRef.current = user?.id || null;
  }, [user?.id]);

  // Restore session from storage on mount
  useEffect(() => {
    async function restoreSession() {
      if (!user) return;

      try {
        const savedSessionId = await StorageService.getRouteSessionId();
        const savedStart = await StorageService.getRouteSessionStart();

        if (savedSessionId) {
          sessionIdRef.current = savedSessionId;
          setState(prev => ({
            ...prev,
            isTracking: true,
            sessionId: savedSessionId,
            startTime: savedStart,
          }));

          // Restart GPS tracking
          const bg = await getBackgroundLocation();
          if (bg) await bg.startBackgroundLocationTracking();

          console.log('[RouteTracking] Restored session:', savedSessionId);
        }
      } catch (error) {
        console.error('[RouteTracking] Restore failed:', error);
      }
    }

    restoreSession();
  }, [user?.id]);

  // ── 8 PM Reminder & 10 PM Auto-End Timer ──────────────────────────
  useEffect(() => {
    if (!state.isTracking) return;

    const interval = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();

      // 8 PM Reminder
      if (hour >= 20 && hour < 22 && !reminderShownRef.current) {
        reminderShownRef.current = true;
        Alert.alert(
          '⏰ Route End Reminder',
          '8 baj gaye hain! Apna route end karein aur data sync upload karein.',
          [{ text: 'OK' }]
        );
      }

      // 10 PM Auto-End
      if (hour >= 22 && state.isTracking) {
        Alert.alert(
          '🌙 Route Auto-End',
          '10 baj gaye hain — route automatically end ho raha hai. Data sync upload karein.',
          [{ text: 'OK' }]
        );
        // Auto-end the route using ref (avoids stale closure)
        endRouteRef.current();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [state.isTracking]);

  // Handle app foreground transitions
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === 'active' && state.isTracking && sessionIdRef.current) {
        try {
          const bg = await getBackgroundLocation();
          if (bg) {
            await bg.resumeTrackingIfNeeded();
          }
        } catch (error) {
          console.error('[RouteTracking] Resume failed:', error);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [state.isTracking]);

  // Start a new route session
  const startRoute = useCallback(async () => {
    if (!user) return;

    // If already tracking, don't start again
    if (sessionIdRef.current || state.isTracking) {
      console.log('[RouteTracking] Already tracking, skipping start');
      return;
    }

    setState(prev => ({ ...prev, isStarting: true, error: null }));

    try {
      const bg = await getBackgroundLocation();
      const service = await getRouteTrackingService();

      // Get current GPS location (non-blocking — null if GPS unavailable)
      let location: { lat: number; lng: number; accuracy: number | null; address?: string } | null = null;
      if (bg) {
        try {
          location = await bg.getCurrentLocation();
        } catch (gpsError: any) {
          console.warn('[RouteTracking] GPS not available, starting without location:', gpsError.message);
        }
      }

      const localSessionId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      let session: RouteSession;
      if (service) {
        try {
          const result = await service.startRoute({
            orderbookerId: user.id,
            startLat: location?.lat,
            startLng: location?.lng,
            startAddress: location?.address,
          });
          session = result.session;
          console.log('[RouteTracking] Server session created:', session.id);
        } catch (e: any) {
          // Check for "already active session" error — if so, use the existing session
          if (e.message?.includes('already has an active')) {
            console.warn('[RouteTracking] Active session exists on server, fetching it...');
            try {
              const activeData = await service.getActiveSession(user.id);
              if (activeData?.session) {
                session = activeData.session;
                console.log('[RouteTracking] Using existing server session:', session.id);
              } else {
                session = createLocalSession(localSessionId, user.id, location);
                await saveLocalStartInfo(localSessionId, user.id, session);
              }
            } catch (fetchErr: any) {
              console.warn('[RouteTracking] Failed to fetch active session:', fetchErr.message);
              session = createLocalSession(localSessionId, user.id, location);
              await saveLocalStartInfo(localSessionId, user.id, session);
            }
          } else {
            console.warn('[RouteTracking] Server start failed, using local session:', e.message);
            session = createLocalSession(localSessionId, user.id, location);
            await saveLocalStartInfo(localSessionId, user.id, session);
          }
        }
      } else {
        session = createLocalSession(localSessionId, user.id, location);
        await saveLocalStartInfo(localSessionId, user.id, session);
      }

      sessionIdRef.current = session.id;
      await StorageService.saveRouteSessionId(session.id);
      reminderShownRef.current = false; // Reset reminder for new session

      if (bg) {
        try {
          await bg.startBackgroundLocationTracking();
        } catch (gpsStartError: any) {
          console.warn('[RouteTracking] GPS tracking failed to start:', gpsStartError.message);
          // Route still starts even if GPS fails — locations will be queued later
        }
      }

      setState({
        isTracking: true, sessionId: session.id, session,
        startTime: new Date().toISOString(),
        lastProximity: null, isStarting: false, isStopping: false, error: null,
      });

      console.log('[RouteTracking] Route started:', session.id, session.id.startsWith('local_') ? '(OFFLINE)' : '(ONLINE)');
    } catch (error: any) {
      console.error('[RouteTracking] Start failed:', error);
      setState(prev => ({ ...prev, isStarting: false, error: error.message || 'Route start nahi ho saka. Dobarra try karein.' }));
    }
  }, [user, state.isTracking]);

  // Helper: Create a local session object
  function createLocalSession(
    sessionId: string, orderbookerId: string,
    location: { lat: number; lng: number; accuracy: number | null; address?: string } | null
  ): RouteSession {
    return {
      id: sessionId, orderbookerId,
      startTime: new Date().toISOString(), endTime: null,
      startLat: location?.lat ?? null, startLng: location?.lng ?? null,
      startAddress: location?.address ?? null,
      endLat: null, endLng: null, endAddress: null,
      totalDistance: 0, totalDuration: null,
      status: 'active', autoEndReason: null,
    };
  }

  // Helper: Save local start info for later sync
  async function saveLocalStartInfo(
    sessionId: string, orderbookerId: string,
    session: RouteSession
  ) {
    await StorageService.saveRouteStartInfo({
      sessionId, orderbookerId,
      startTime: session.startTime,
      startLat: session.startLat, startLng: session.startLng,
      startAddress: session.startAddress,
    });
  }

  // End the current route session
  const endRoute = useCallback(async () => {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) return;

    setState(prev => ({ ...prev, isStopping: true, error: null }));

    try {
      const bg = await getBackgroundLocation();
      const service = await getRouteTrackingService();

      if (bg) await bg.stopBackgroundLocationTracking();

      const location = bg ? await bg.getCurrentLocation() : null;

      if (service && !currentSessionId.startsWith('local_')) {
        try {
          await service.endRoute({
            sessionId: currentSessionId,
            endLat: location?.lat, endLng: location?.lng, endAddress: location?.address,
          });
          console.log('[RouteTracking] Route ended on server');
        } catch (e: any) {
          console.warn('[RouteTracking] Server end failed:', e.message);
        }
      }

      // Save end info for manual sync upload
      await StorageService.saveRouteEndInfo({
        sessionId: currentSessionId,
        endTime: new Date().toISOString(),
        endLat: location?.lat ?? null,
        endLng: location?.lng ?? null,
        endAddress: location?.address ?? null,
      });

      await StorageService.saveRouteSessionId(null);
      sessionIdRef.current = null;

      // Persist the ended session ID so the route-summary screen can fetch recoveries
      // AND so the "Resume Route" button can re-open it (same-day only).
      // Skip local-only (offline) sessions — they cannot be resumed on the server.
      if (!currentSessionId.startsWith('local_')) {
        try {
          await StorageService.saveLastEndedSession(currentSessionId);
          setLastEndedSessionId(currentSessionId);
        } catch (e) {
          console.warn('[RouteTracking] Failed to persist ended session ID:', e);
        }
      }

      setState({ ...initialState });

      // NOTE: No Alert here — the caller (handleEndRoute in (tabs)/index.tsx)
      // already does sync upload + auto-redirect to /route-summary.
      // Showing an Alert here used to block the redirect and made the
      // Resume button on the summary page look "broken" (Alert sat on top
      // of the summary screen, hiding the action bar).
    } catch (error: any) {
      console.error('[RouteTracking] End failed:', error);
      setState(prev => ({ ...prev, isStopping: false, error: error.message || 'Failed to end route' }));
    }
  }, []);

  // Keep endRoute ref in sync so timer can call latest version
  useEffect(() => {
    endRouteRef.current = endRoute;
  }, [endRoute]);

  // Resume the last ended route session — same-day only.
  // Re-opens the session on the server (status → active, endTime cleared),
  // restores local tracking state, and re-starts GPS.
  // Throws if there's no resumable session or the server refuses (e.g. next-day).
  const resumeRoute = useCallback(async () => {
    if (!user) return;

    setIsResuming(true);
    setState(prev => ({ ...prev, error: null }));

    try {
      const resumableId = await StorageService.getResumableSessionId();
      if (!resumableId) {
        throw new Error('Koi resumable route nahi mila aaj ke liye. Naya route start karein.');
      }

      const service = await getRouteTrackingService();
      if (!service) {
        throw new Error('Route tracking service load nahi ho saka. App restart karein.');
      }

      const { session } = await service.resumeRoute(resumableId);

      // Restore local state
      sessionIdRef.current = session.id;
      await StorageService.saveRouteSessionId(session.id);
      await StorageService.clearLastEndedSession();
      setLastEndedSessionId(null);

      // Restart GPS tracking
      const bg = await getBackgroundLocation();
      if (bg) {
        try {
          await bg.startBackgroundLocationTracking();
        } catch (gpsStartError: any) {
          console.warn('[RouteTracking] GPS tracking failed to start on resume:', gpsStartError.message);
        }
      }

      setState({
        isTracking: true,
        sessionId: session.id,
        session,
        startTime: session.startTime,
        lastProximity: null,
        isStarting: false,
        isStopping: false,
        error: null,
      });

      console.log('[RouteTracking] Route resumed:', session.id);
    } catch (error: any) {
      console.error('[RouteTracking] Resume failed:', error);
      setState(prev => ({ ...prev, error: error.message || 'Route resume nahi ho saka. Dobarra try karein.' }));
      throw error;
    } finally {
      setIsResuming(false);
    }
  }, [user]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return (
    <RouteTrackingContext.Provider
      value={{
        ...state,
        isResuming,
        lastEndedSessionId,
        startRoute,
        endRoute,
        resumeRoute,
        clearError,
      }}
    >
      {children}
    </RouteTrackingContext.Provider>
  );
}

// ── Exported Provider with Error Boundary ──────────────────────────
export function RouteTrackingProvider({ children }: { children: React.ReactNode }) {
  return (
    <RouteTrackingErrorBoundary>
      <RouteTrackingProviderInner>
        {children}
      </RouteTrackingProviderInner>
    </RouteTrackingErrorBoundary>
  );
}
