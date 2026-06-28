// Powered by Finexa
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Shop } from './api';
import { getTodayDateStr } from '@/utils/format';

const KEYS = {
  USER: 'af_user',
  TOKEN: 'af_token',
  SHOPS: 'af_shops',
  OFFLINE_QUEUE: 'af_offline_queue',
  LAST_SYNC: 'af_last_sync',
  PENDING_NOTIFICATIONS: 'af_pending_notifications',
  LAST_RECOVERY_DATES: 'af_last_recovery_dates',
  TOUR_COMPLETED: 'af_tour_completed',
  SHOP_NOTES: 'af_shop_notes',
  DAILY_TARGETS: 'af_daily_targets',
  VISIT_STREAKS: 'af_visit_streaks',
  TODAY_RECOVERY: 'af_today_recovery',
  NOTIF_COUNTS: 'af_notif_counts',
  NOTIF_SHOPS: 'af_notif_shops', // track unique shop IDs for SMS/WhatsApp
  VISITED_SHOPS: 'af_visited_shops',
  RECOVERY_SUBMITTED_SHOPS: 'af_recovery_submitted_shops',
  OFFLINE_PHONE_UPDATES: 'af_offline_phone_updates',
  DISTRIBUTOR_PHONE: 'af_distributor_phone', // saved locally for offline receipt use
  SELECTED_COMPANY_ID: 'af_selected_company_id', // persisted selected company
  ROUTE_SESSION_ID: 'af_route_session_id', // active route session ID
  ROUTE_SESSION_START: 'af_route_session_start', // ISO timestamp when route started
  OFFLINE_ROUTE_LOCATIONS: 'af_offline_route_locations', // GPS locations queued while offline
  PENDING_ROUTE_END: 'af_pending_route_end', // Route end info pending sync
  PENDING_ROUTE_START: 'af_pending_route_start', // Route start info pending sync (offline start)
  VISIT_GPS_COORDS: 'af_visit_gps_coords', // Shop GPS coordinates from visits (shopId → {lat, lng})
  CUSTOM_API_URL: 'af_custom_api_url', // Manual URL configuration
  DATA_DOWNLOADED_DATE: 'af_data_downloaded_date', // Date when data was last downloaded (YYYY-MM-DD)
  LAST_SYNC_UPLOAD_DATE: 'af_last_sync_upload_date', // Date when data was last uploaded (YYYY-MM-DD)
  DATA_DOWNLOADED_FOR_DATE: 'af_data_downloaded_for_date', // Date for which data was downloaded
  LAST_ENDED_SESSION_ID: 'af_last_ended_session_id', // last ended session ID — used for resume
  LAST_ENDED_SESSION_DATE: 'af_last_ended_session_date', // YYYY-MM-DD of last end — guards resume to same day
  OFFLINE_SMS_LOGS: 'af_offline_sms_logs', // pending SMS logs queued while offline
  OVERDUE_SHOPS: 'af_overdue_shops', // cached overdue shops data
  BUSINESS_NAME: 'af_business_name', // cached business name from CMS
};

export interface PendingNotification {
  id: string; // unique: shopId + timestamp
  shopId: string;
  shopName: string;
  shopPhone: string;
  area: string;
  openingBalance: number;
  recoveryAmount: number;
  remainingBalance: number;
  companyName?: string;
  orderbookerName?: string;
  distributorPhone?: string;
  createdAt: string;
  date: string; // YYYY-MM-DD for daily grouping
}

export interface OfflineRecovery {
  localId: string;
  shopId: string;
  shopName: string;
  amount: number;
  description?: string;
  gpsLat?: number;
  gpsLng?: number;
  gpsAddress?: string;
  createdBy: string;
  createdAt: string;
  companyId?: string; // Capture company at creation time, not at sync time
}

export interface ShopLastRecovery {
  shopId: string;
  lastRecoveryDate: string;
}

export interface OfflinePhoneUpdate {
  shopId: string;
  phone: string;
  ownerName?: string;
  createdAt: string;
}

export interface OfflineSmsLog {
  id: string; // unique local ID
  shopId: string;
  shopName: string;
  shopPhone: string;
  orderbookerId: string;
  transactionId?: string;
  method: 'sms' | 'whatsapp';
  status: 'sent' | 'failed' | 'skipped';
  message?: string;
  errorMessage?: string;
  sentAt: string;
  createdAt: string; // ISO timestamp when log was queued
}

export interface OverdueShop {
  shopId: string;
  shopName: string;
  shopArea: string | null;
  balance: number;
  lastRecoveryDate: string | null;
  daysOverdue: number;
}

export interface ShopNote {
  shopId: string;
  note: string;
  updatedAt: string;
}

export interface DailyTarget {
  orderbookerId: string;
  target: number;
  month: string;
}

export interface VisitStreak {
  orderbookerId: string;
  currentStreak: number;
  lastVisitDate: string;
  longestStreak: number;
}

export const StorageService = {
  saveUser: async (user: User, token: string) => {
    await AsyncStorage.multiSet([
      [KEYS.USER, JSON.stringify(user)],
      [KEYS.TOKEN, token],
    ]);
  },

  getUser: async (): Promise<User | null> => {
    const raw = await AsyncStorage.getItem(KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  },

  getToken: async (): Promise<string | null> => {
    return AsyncStorage.getItem(KEYS.TOKEN);
  },

  clearSession: async () => {
    await AsyncStorage.multiRemove([KEYS.USER, KEYS.TOKEN, KEYS.ROUTE_SESSION_ID, KEYS.ROUTE_SESSION_START]);
  },

  saveShops: async (shops: Shop[]) => {
    await AsyncStorage.setItem(KEYS.SHOPS, JSON.stringify(shops));
    await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
  },

  getShops: async (): Promise<Shop[]> => {
    const raw = await AsyncStorage.getItem(KEYS.SHOPS);
    return raw ? JSON.parse(raw) : [];
  },

  getLastSync: async (): Promise<string | null> => {
    return AsyncStorage.getItem(KEYS.LAST_SYNC);
  },

  addOfflineRecovery: async (recovery: OfflineRecovery) => {
    const raw = await AsyncStorage.getItem(KEYS.OFFLINE_QUEUE);
    const queue: OfflineRecovery[] = raw ? JSON.parse(raw) : [];
    queue.push(recovery);
    await AsyncStorage.setItem(KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  },

  getOfflineQueue: async (): Promise<OfflineRecovery[]> => {
    const raw = await AsyncStorage.getItem(KEYS.OFFLINE_QUEUE);
    return raw ? JSON.parse(raw) : [];
  },

  removeFromOfflineQueue: async (localIds: string[]) => {
    const raw = await AsyncStorage.getItem(KEYS.OFFLINE_QUEUE);
    const queue: OfflineRecovery[] = raw ? JSON.parse(raw) : [];
    const filtered = queue.filter((r) => !localIds.includes(r.localId));
    await AsyncStorage.setItem(KEYS.OFFLINE_QUEUE, JSON.stringify(filtered));
  },

  clearOfflineQueue: async () => {
    await AsyncStorage.setItem(KEYS.OFFLINE_QUEUE, JSON.stringify([]));
  },

  // --- Pending Notifications Tracking ---
  addPendingNotification: async (notification: PendingNotification) => {
    const raw = await AsyncStorage.getItem(KEYS.PENDING_NOTIFICATIONS);
    const list: PendingNotification[] = raw ? JSON.parse(raw) : [];
    // Avoid duplicates by same shopId on same date
    const exists = list.some(
      (n) => n.shopId === notification.shopId && n.date === notification.date
    );
    if (!exists) {
      list.push(notification);
      await AsyncStorage.setItem(KEYS.PENDING_NOTIFICATIONS, JSON.stringify(list));
    }
  },

  getPendingNotifications: async (date?: string): Promise<PendingNotification[]> => {
    const raw = await AsyncStorage.getItem(KEYS.PENDING_NOTIFICATIONS);
    const list: PendingNotification[] = raw ? JSON.parse(raw) : [];
    if (date) {
      // Return only today's pending notifications
      return list.filter((n) => n.date === date);
    }
    return list;
  },

  removePendingNotification: async (id: string) => {
    const raw = await AsyncStorage.getItem(KEYS.PENDING_NOTIFICATIONS);
    const list: PendingNotification[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((n) => n.id !== id);
    await AsyncStorage.setItem(KEYS.PENDING_NOTIFICATIONS, JSON.stringify(filtered));
  },

  clearPendingNotifications: async (date?: string) => {
    if (date) {
      const raw = await AsyncStorage.getItem(KEYS.PENDING_NOTIFICATIONS);
      const list: PendingNotification[] = raw ? JSON.parse(raw) : [];
      const filtered = list.filter((n) => n.date !== date);
      await AsyncStorage.setItem(KEYS.PENDING_NOTIFICATIONS, JSON.stringify(filtered));
    } else {
      await AsyncStorage.setItem(KEYS.PENDING_NOTIFICATIONS, JSON.stringify([]));
    }
  },

  // --- Offline Data Expiry (7 Day Auto-Clear) ---
  cleanExpiredOfflineQueue: async (): Promise<number> => {
    const raw = await AsyncStorage.getItem(KEYS.OFFLINE_QUEUE);
    const queue: OfflineRecovery[] = raw ? JSON.parse(raw) : [];
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const before = queue.length;
    const filtered = queue.filter((r) => {
      const created = new Date(r.createdAt).getTime();
      return created >= cutoff;
    });
    const removed = before - filtered.length;
    if (removed > 0) {
      await AsyncStorage.setItem(KEYS.OFFLINE_QUEUE, JSON.stringify(filtered));
    }
    return removed;
  },

  // --- Recurring Recovery Reminder (Last Recovery Dates) ---
  updateLastRecoveryDate: async (shopId: string, date: string) => {
    const raw = await AsyncStorage.getItem(KEYS.LAST_RECOVERY_DATES);
    const list: ShopLastRecovery[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((e) => e.shopId === shopId);
    if (idx >= 0) {
      list[idx].lastRecoveryDate = date;
    } else {
      list.push({ shopId, lastRecoveryDate: date });
    }
    await AsyncStorage.setItem(KEYS.LAST_RECOVERY_DATES, JSON.stringify(list));
  },

  getLastRecoveryDates: async (): Promise<ShopLastRecovery[]> => {
    const raw = await AsyncStorage.getItem(KEYS.LAST_RECOVERY_DATES);
    return raw ? JSON.parse(raw) : [];
  },

  getShopsNeedingRecovery: async (minDays: number): Promise<ShopLastRecovery[]> => {
    const raw = await AsyncStorage.getItem(KEYS.LAST_RECOVERY_DATES);
    const list: ShopLastRecovery[] = raw ? JSON.parse(raw) : [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - minDays);
    const cutoffStr = cutoff.toISOString();
    return list.filter((e) => e.lastRecoveryDate <= cutoffStr);
  },

  removeLastRecoveryDate: async (shopId: string) => {
    const raw = await AsyncStorage.getItem(KEYS.LAST_RECOVERY_DATES);
    const list: ShopLastRecovery[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((e) => e.shopId !== shopId);
    await AsyncStorage.setItem(KEYS.LAST_RECOVERY_DATES, JSON.stringify(filtered));
  },

  // --- App Tour / First-Time Walkthrough ---
  isTourCompleted: async (): Promise<boolean> => {
    const raw = await AsyncStorage.getItem(KEYS.TOUR_COMPLETED);
    return raw === 'true';
  },

  markTourCompleted: async () => {
    await AsyncStorage.setItem(KEYS.TOUR_COMPLETED, 'true');
  },

  // --- Shop Notes / Remarks ---
  saveShopNote: async (shopId: string, note: string) => {
    const raw = await AsyncStorage.getItem(KEYS.SHOP_NOTES);
    const notes: ShopNote[] = raw ? JSON.parse(raw) : [];
    const existingIndex = notes.findIndex((n) => n.shopId === shopId);
    const entry: ShopNote = { shopId, note, updatedAt: new Date().toISOString() };
    if (existingIndex >= 0) {
      notes[existingIndex] = entry;
    } else {
      notes.push(entry);
    }
    await AsyncStorage.setItem(KEYS.SHOP_NOTES, JSON.stringify(notes));
  },

  getShopNote: async (shopId: string): Promise<ShopNote | null> => {
    const raw = await AsyncStorage.getItem(KEYS.SHOP_NOTES);
    const notes: ShopNote[] = raw ? JSON.parse(raw) : [];
    return notes.find((n) => n.shopId === shopId) || null;
  },

  getAllShopNotes: async (): Promise<ShopNote[]> => {
    const raw = await AsyncStorage.getItem(KEYS.SHOP_NOTES);
    return raw ? JSON.parse(raw) : [];
  },

  deleteShopNote: async (shopId: string) => {
    const raw = await AsyncStorage.getItem(KEYS.SHOP_NOTES);
    const notes: ShopNote[] = raw ? JSON.parse(raw) : [];
    const filtered = notes.filter((n) => n.shopId !== shopId);
    await AsyncStorage.setItem(KEYS.SHOP_NOTES, JSON.stringify(filtered));
  },

  // --- Daily Targets ---
  saveDailyTarget: async (target: DailyTarget) => {
    const raw = await AsyncStorage.getItem(KEYS.DAILY_TARGETS);
    const targets: DailyTarget[] = raw ? JSON.parse(raw) : [];
    const existingIndex = targets.findIndex(
      (t) => t.orderbookerId === target.orderbookerId && t.month === target.month
    );
    if (existingIndex >= 0) {
      targets[existingIndex] = target;
    } else {
      targets.push(target);
    }
    await AsyncStorage.setItem(KEYS.DAILY_TARGETS, JSON.stringify(targets));
  },

  getDailyTarget: async (orderbookerId: string, month: string): Promise<DailyTarget | null> => {
    const raw = await AsyncStorage.getItem(KEYS.DAILY_TARGETS);
    const targets: DailyTarget[] = raw ? JSON.parse(raw) : [];
    return targets.find((t) => t.orderbookerId === orderbookerId && t.month === month) || null;
  },

  getDailyTargets: async (): Promise<DailyTarget[]> => {
    const raw = await AsyncStorage.getItem(KEYS.DAILY_TARGETS);
    return raw ? JSON.parse(raw) : [];
  },

  // --- Visit Streak Tracking ---
  saveVisitStreak: async (streak: VisitStreak) => {
    const raw = await AsyncStorage.getItem(KEYS.VISIT_STREAKS);
    const streaks: VisitStreak[] = raw ? JSON.parse(raw) : [];
    const idx = streaks.findIndex((s) => s.orderbookerId === streak.orderbookerId);
    if (idx >= 0) {
      streaks[idx] = streak;
    } else {
      streaks.push(streak);
    }
    await AsyncStorage.setItem(KEYS.VISIT_STREAKS, JSON.stringify(streaks));
  },

  getVisitStreak: async (orderbookerId: string): Promise<VisitStreak | null> => {
    const raw = await AsyncStorage.getItem(KEYS.VISIT_STREAKS);
    const streaks: VisitStreak[] = raw ? JSON.parse(raw) : [];
    return streaks.find((s) => s.orderbookerId === orderbookerId) ?? null;
  },

  updateVisitStreak: async (orderbookerId: string, visitedToday: boolean): Promise<VisitStreak> => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const existing = await StorageService.getVisitStreak(orderbookerId);

    if (!existing) {
      const newStreak: VisitStreak = {
        orderbookerId,
        currentStreak: visitedToday ? 1 : 0,
        lastVisitDate: visitedToday ? today : '',
        longestStreak: visitedToday ? 1 : 0,
      };
      await StorageService.saveVisitStreak(newStreak);
      return newStreak;
    }

    // Already updated today
    if (existing.lastVisitDate === today) {
      return existing;
    }

    if (visitedToday) {
      // Check if last visit was yesterday (consecutive)
      const lastVisit = new Date(existing.lastVisitDate);
      const todayDate = new Date(today);
      const diffDays = Math.round((todayDate.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));

      const newCurrentStreak = diffDays <= 1 ? existing.currentStreak + 1 : 1;
      const newLongestStreak = Math.max(existing.longestStreak, newCurrentStreak);

      const updated: VisitStreak = {
        ...existing,
        currentStreak: newCurrentStreak,
        lastVisitDate: today,
        longestStreak: newLongestStreak,
      };
      await StorageService.saveVisitStreak(updated);
      return updated;
    } else {
      // Not visited today — check if streak should be broken
      const lastVisit = new Date(existing.lastVisitDate);
      const todayDate = new Date(today);
      const diffDays = Math.round((todayDate.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays > 1) {
        // Streak broken — reset
        const updated: VisitStreak = {
          ...existing,
          currentStreak: 0,
        };
        await StorageService.saveVisitStreak(updated);
        return updated;
      }
      return existing;
    }
  },

  // --- Today's Recovery Cache (persists across page refreshes) ---
  saveTodayRecovery: async (amount: number) => {
    const entry = { date: getTodayDateStr(), amount };
    await AsyncStorage.setItem(KEYS.TODAY_RECOVERY, JSON.stringify(entry));
  },

  getTodayRecovery: async (): Promise<number> => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.TODAY_RECOVERY);
      if (!raw) return 0;
      const entry = JSON.parse(raw);
      // Only return cached value if it's from today
      return entry.date === getTodayDateStr() ? entry.amount : 0;
    } catch {
      return 0;
    }
  },

  // --- Notification Counts (SMS/WhatsApp sent today) ---
  getNotifCounts: async (): Promise<{ sms: number; whatsapp: number }> => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.NOTIF_COUNTS);
      if (!raw) return { sms: 0, whatsapp: 0 };
      const entry = JSON.parse(raw);
      // Only return if from today, otherwise reset
      return entry.date === getTodayDateStr()
        ? { sms: entry.sms || 0, whatsapp: entry.whatsapp || 0 }
        : { sms: 0, whatsapp: 0 };
    } catch {
      return { sms: 0, whatsapp: 0 };
    }
  },

  incrementNotifCount: async (method: 'sms' | 'whatsapp', shopId?: string): Promise<{ sms: number; whatsapp: number }> => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.NOTIF_COUNTS);
      const shopsRaw = await AsyncStorage.getItem(KEYS.NOTIF_SHOPS);
      let entry: { date: string; sms: number; whatsapp: number };
      let shopsEntry: { date: string; smsShops: string[]; whatsappShops: string[] };

      if (!raw) {
        entry = { date: getTodayDateStr(), sms: 0, whatsapp: 0 };
      } else {
        entry = JSON.parse(raw);
        if (entry.date !== getTodayDateStr()) {
          entry = { date: getTodayDateStr(), sms: 0, whatsapp: 0 };
        }
      }

      if (!shopsRaw) {
        shopsEntry = { date: getTodayDateStr(), smsShops: [], whatsappShops: [] };
      } else {
        shopsEntry = JSON.parse(shopsRaw);
        if (shopsEntry.date !== getTodayDateStr()) {
          shopsEntry = { date: getTodayDateStr(), smsShops: [], whatsappShops: [] };
        }
      }

      // Only increment count if this shop hasn't been counted before for this method
      if (shopId) {
        const shopKey = method === 'sms' ? 'smsShops' : 'whatsappShops';
        if (!shopsEntry[shopKey].includes(shopId)) {
          shopsEntry[shopKey].push(shopId);
          entry[method] = (entry[method] || 0) + 1;
        }
      } else {
        // Fallback: no shopId, just increment
        entry[method] = (entry[method] || 0) + 1;
      }

      await AsyncStorage.setItem(KEYS.NOTIF_COUNTS, JSON.stringify(entry));
      await AsyncStorage.setItem(KEYS.NOTIF_SHOPS, JSON.stringify(shopsEntry));
      return { sms: entry.sms, whatsapp: entry.whatsapp };
    } catch {
      return { sms: 0, whatsapp: 0 };
    }
  },

  // --- Visited Shops (persists across page refreshes, resets daily) ---
  saveVisitedShops: async (shopIds: string[]) => {
    const entry = { date: getTodayDateStr(), shopIds };
    await AsyncStorage.setItem(KEYS.VISITED_SHOPS, JSON.stringify(entry));
  },

  getVisitedShops: async (): Promise<string[]> => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.VISITED_SHOPS);
      if (!raw) return [];
      const entry = JSON.parse(raw);
      // Only return if from today, otherwise reset
      return entry.date === getTodayDateStr() ? entry.shopIds || [] : [];
    } catch {
      return [];
    }
  },

  addVisitedShop: async (shopId: string) => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.VISITED_SHOPS);
      let entry: { date: string; shopIds: string[] };
      if (!raw) {
        entry = { date: getTodayDateStr(), shopIds: [] };
      } else {
        entry = JSON.parse(raw);
        if (entry.date !== getTodayDateStr()) {
          entry = { date: getTodayDateStr(), shopIds: [] };
        }
      }
      if (!entry.shopIds.includes(shopId)) {
        entry.shopIds.push(shopId);
        await AsyncStorage.setItem(KEYS.VISITED_SHOPS, JSON.stringify(entry));
      }
    } catch { /* non-critical */ }
  },

  // --- Visit GPS Coordinates (shop GPS from visits, used for map display) ---
  saveVisitGpsCoord: async (shopId: string, lat: number, lng: number) => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.VISIT_GPS_COORDS);
      let map: Record<string, { lat: number; lng: number }> = {};
      if (raw) {
        try { map = JSON.parse(raw); } catch { map = {}; }
      }
      map[shopId] = { lat, lng };
      await AsyncStorage.setItem(KEYS.VISIT_GPS_COORDS, JSON.stringify(map));
    } catch { /* non-critical */ }
  },

  getVisitGpsCoords: async (): Promise<Record<string, { lat: number; lng: number }>> => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.VISIT_GPS_COORDS);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  },

  // --- Recovery Submitted Shops (duplicate prevention - persists daily) ---
  saveRecoverySubmittedShops: async (shopIds: string[]) => {
    const entry = { date: getTodayDateStr(), shopIds };
    await AsyncStorage.setItem(KEYS.RECOVERY_SUBMITTED_SHOPS, JSON.stringify(entry));
  },

  getRecoverySubmittedShops: async (): Promise<string[]> => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.RECOVERY_SUBMITTED_SHOPS);
      if (!raw) return [];
      const entry = JSON.parse(raw);
      // Only return if from today, otherwise reset
      return entry.date === getTodayDateStr() ? entry.shopIds || [] : [];
    } catch {
      return [];
    }
  },

  addRecoverySubmittedShop: async (shopId: string) => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.RECOVERY_SUBMITTED_SHOPS);
      let entry: { date: string; shopIds: string[] };
      if (!raw) {
        entry = { date: getTodayDateStr(), shopIds: [] };
      } else {
        entry = JSON.parse(raw);
        if (entry.date !== getTodayDateStr()) {
          entry = { date: getTodayDateStr(), shopIds: [] };
        }
      }
      if (!entry.shopIds.includes(shopId)) {
        entry.shopIds.push(shopId);
        await AsyncStorage.setItem(KEYS.RECOVERY_SUBMITTED_SHOPS, JSON.stringify(entry));
      }
    } catch { /* non-critical */ }
  },

  removeRecoverySubmittedShop: async (shopId: string) => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.RECOVERY_SUBMITTED_SHOPS);
      if (!raw) return;
      const entry = JSON.parse(raw);
      if (entry.date !== getTodayDateStr()) return;
      entry.shopIds = entry.shopIds.filter((id: string) => id !== shopId);
      await AsyncStorage.setItem(KEYS.RECOVERY_SUBMITTED_SHOPS, JSON.stringify(entry));
    } catch { /* non-critical */ }
  },

  // --- Offline Phone Updates (synced to server when online) ---
  addOfflinePhoneUpdate: async (update: OfflinePhoneUpdate) => {
    const raw = await AsyncStorage.getItem(KEYS.OFFLINE_PHONE_UPDATES);
    const queue: OfflinePhoneUpdate[] = raw ? JSON.parse(raw) : [];
    // Replace existing entry for same shopId
    const idx = queue.findIndex((u) => u.shopId === update.shopId);
    if (idx >= 0) {
      queue[idx] = update;
    } else {
      queue.push(update);
    }
    await AsyncStorage.setItem(KEYS.OFFLINE_PHONE_UPDATES, JSON.stringify(queue));
  },

  getOfflinePhoneUpdates: async (): Promise<OfflinePhoneUpdate[]> => {
    const raw = await AsyncStorage.getItem(KEYS.OFFLINE_PHONE_UPDATES);
    return raw ? JSON.parse(raw) : [];
  },

  removeOfflinePhoneUpdate: async (shopId: string) => {
    const raw = await AsyncStorage.getItem(KEYS.OFFLINE_PHONE_UPDATES);
    const queue: OfflinePhoneUpdate[] = raw ? JSON.parse(raw) : [];
    const filtered = queue.filter((u) => u.shopId !== shopId);
    await AsyncStorage.setItem(KEYS.OFFLINE_PHONE_UPDATES, JSON.stringify(filtered));
  },

  clearOfflinePhoneUpdates: async () => {
    await AsyncStorage.setItem(KEYS.OFFLINE_PHONE_UPDATES, JSON.stringify([]));
  },

  // --- Distributor Phone (persisted locally for offline receipt) ---
  saveDistributorPhone: async (phone: string) => {
    await AsyncStorage.setItem(KEYS.DISTRIBUTOR_PHONE, phone);
  },

  getDistributorPhone: async (): Promise<string | null> => {
    return AsyncStorage.getItem(KEYS.DISTRIBUTOR_PHONE);
  },

  // --- Selected Company ID (persists across app restarts) ---
  saveSelectedCompanyId: async (companyId: string | null) => {
    if (companyId) {
      await AsyncStorage.setItem(KEYS.SELECTED_COMPANY_ID, companyId);
    } else {
      await AsyncStorage.removeItem(KEYS.SELECTED_COMPANY_ID);
    }
  },

  getSelectedCompanyId: async (): Promise<string | null> => {
    return AsyncStorage.getItem(KEYS.SELECTED_COMPANY_ID);
  },

  // --- Route Session (active route tracking) ---
  saveRouteSessionId: async (sessionId: string | null) => {
    if (sessionId) {
      await AsyncStorage.multiSet([
        [KEYS.ROUTE_SESSION_ID, sessionId],
        [KEYS.ROUTE_SESSION_START, new Date().toISOString()],
      ]);
    } else {
      await AsyncStorage.multiRemove([KEYS.ROUTE_SESSION_ID, KEYS.ROUTE_SESSION_START]);
    }
  },

  getRouteSessionId: async (): Promise<string | null> => {
    return AsyncStorage.getItem(KEYS.ROUTE_SESSION_ID);
  },

  getRouteSessionStart: async (): Promise<string | null> => {
    return AsyncStorage.getItem(KEYS.ROUTE_SESSION_START);
  },

  // --- Offline Route Locations (GPS waypoints saved when no internet) ---
  // These persist across app kills/crashes — locations are NOT lost!
  addOfflineRouteLocations: async (locations: Array<{
    lat: number;
    lng: number;
    accuracy: number | null;
    speed: number | null;
    altitude: number | null;
    batteryLevel: number | null;
    isOffline: boolean;
    recordedAt: string;
  }>) => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_ROUTE_LOCATIONS);
      const existing: Array<typeof locations[0]> = raw ? JSON.parse(raw) : [];
      existing.push(...locations);
      // Keep max 2000 locations (~16 hours at 30s intervals = full working day offline)
      const trimmed = existing.length > 2000 ? existing.slice(-2000) : existing;
      await AsyncStorage.setItem(KEYS.OFFLINE_ROUTE_LOCATIONS, JSON.stringify(trimmed));
    } catch (e) {
      console.error('[Storage] Failed to save offline route locations:', e);
    }
  },

  getOfflineRouteLocations: async (): Promise<Array<{
    lat: number;
    lng: number;
    accuracy: number | null;
    speed: number | null;
    altitude: number | null;
    batteryLevel: number | null;
    isOffline: boolean;
    recordedAt: string;
  }>> => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_ROUTE_LOCATIONS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  clearOfflineRouteLocations: async () => {
    try {
      await AsyncStorage.removeItem(KEYS.OFFLINE_ROUTE_LOCATIONS);
    } catch {}
  },

  // --- Update phone in local shops cache (AsyncStorage) ---
  updateShopPhoneInCache: async (shopId: string, phone: string, ownerName?: string) => {
    const raw = await AsyncStorage.getItem(KEYS.SHOPS);
    if (!raw) return;
    const shops: Shop[] = JSON.parse(raw);
    const idx = shops.findIndex((s) => s.id === shopId);
    if (idx >= 0) {
      shops[idx].phone = phone;
      if (ownerName) {
        shops[idx].ownerName = ownerName;
      }
      await AsyncStorage.setItem(KEYS.SHOPS, JSON.stringify(shops));
    }
  },

  // --- Pending Route End (for offline sync upload) ---
  saveRouteEndInfo: async (info: {
    sessionId: string;
    endTime: string;
    endLat: number | null;
    endLng: number | null;
    endAddress: string | null;
  }) => {
    await AsyncStorage.setItem(KEYS.PENDING_ROUTE_END, JSON.stringify(info));
  },

  getRouteEndInfo: async (): Promise<{
    sessionId: string;
    endTime: string;
    endLat: number | null;
    endLng: number | null;
    endAddress: string | null;
  } | null> => {
    const raw = await AsyncStorage.getItem(KEYS.PENDING_ROUTE_END);
    return raw ? JSON.parse(raw) : null;
  },

  clearRouteEndInfo: async () => {
    await AsyncStorage.removeItem(KEYS.PENDING_ROUTE_END);
  },

  // --- Pending Route Start (for offline sync upload) ---
  saveRouteStartInfo: async (info: {
    sessionId: string;
    orderbookerId: string;
    startTime: string;
    startLat: number | null;
    startLng: number | null;
    startAddress: string | null;
  }) => {
    await AsyncStorage.setItem(KEYS.PENDING_ROUTE_START, JSON.stringify(info));
  },

  getRouteStartInfo: async (): Promise<{
    sessionId: string;
    orderbookerId: string;
    startTime: string;
    startLat: number | null;
    startLng: number | null;
    startAddress: string | null;
  } | null> => {
    const raw = await AsyncStorage.getItem(KEYS.PENDING_ROUTE_START);
    return raw ? JSON.parse(raw) : null;
  },

  clearRouteStartInfo: async () => {
    await AsyncStorage.removeItem(KEYS.PENDING_ROUTE_START);
  },

  // --- Custom API URL (Manual URL Configuration) ---
  saveCustomApiUrl: async (url: string) => {
    await AsyncStorage.setItem(KEYS.CUSTOM_API_URL, url);
  },

  getCustomApiUrl: async (): Promise<string | null> => {
    return AsyncStorage.getItem(KEYS.CUSTOM_API_URL);
  },

  clearCustomApiUrl: async () => {
    await AsyncStorage.removeItem(KEYS.CUSTOM_API_URL);
  },

  // --- Data Download State ---
  saveDataDownloadedDate: async (date: string) => {
    await AsyncStorage.setItem(KEYS.DATA_DOWNLOADED_DATE, date);
  },

  getDataDownloadedDate: async (): Promise<string | null> => {
    return AsyncStorage.getItem(KEYS.DATA_DOWNLOADED_DATE);
  },

  saveDataDownloadedForDate: async (date: string) => {
    await AsyncStorage.setItem(KEYS.DATA_DOWNLOADED_FOR_DATE, date);
  },

  getDataDownloadedForDate: async (): Promise<string | null> => {
    return AsyncStorage.getItem(KEYS.DATA_DOWNLOADED_FOR_DATE);
  },

  // --- Sync Upload State ---
  saveLastSyncUploadDate: async (date: string) => {
    await AsyncStorage.setItem(KEYS.LAST_SYNC_UPLOAD_DATE, date);
  },

  getLastSyncUploadDate: async (): Promise<string | null> => {
    return AsyncStorage.getItem(KEYS.LAST_SYNC_UPLOAD_DATE);
  },

  // --- Check if yesterday's data was synced ---
  // Returns true if yesterday's sync upload is done OR if there's no pending data
  isYesterdaySyncDone: async (): Promise<boolean> => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

    const lastUpload = await AsyncStorage.getItem(KEYS.LAST_SYNC_UPLOAD_DATE);
    const downloadedFor = await AsyncStorage.getItem(KEYS.DATA_DOWNLOADED_FOR_DATE);

    // If we never downloaded data for yesterday, no sync needed
    if (downloadedFor !== yesterdayStr) return true;

    // If we downloaded for yesterday, check if upload was done
    if (lastUpload && lastUpload >= yesterdayStr) return true;

    return false;
  },

  // --- Last Ended Route Session (for Resume feature) ---
  // Saves the sessionId + today's date (YYYY-MM-DD) so that:
  // - The route-summary screen can fetch recoveries for it
  // - The "Resume Route" button can resume it ONLY if it's still the same day
  saveLastEndedSession: async (sessionId: string) => {
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    await AsyncStorage.multiSet([
      [KEYS.LAST_ENDED_SESSION_ID, sessionId],
      [KEYS.LAST_ENDED_SESSION_DATE, todayStr],
    ]);
  },

  getLastEndedSessionId: async (): Promise<string | null> => {
    return AsyncStorage.getItem(KEYS.LAST_ENDED_SESSION_ID);
  },

  getLastEndedSessionDate: async (): Promise<string | null> => {
    return AsyncStorage.getItem(KEYS.LAST_ENDED_SESSION_DATE);
  },

  // Returns the last ended session ID ONLY if it ended today (same calendar day).
  // Returns null if no session or it's from a previous day.
  getResumableSessionId: async (): Promise<string | null> => {
    const [sessionId, sessionDate] = await Promise.all([
      AsyncStorage.getItem(KEYS.LAST_ENDED_SESSION_ID),
      AsyncStorage.getItem(KEYS.LAST_ENDED_SESSION_DATE),
    ]);
    if (!sessionId || !sessionDate) return null;
    const todayStr = new Date().toISOString().split('T')[0];
    if (sessionDate !== todayStr) return null;
    return sessionId;
  },

  clearLastEndedSession: async () => {
    await AsyncStorage.multiRemove([KEYS.LAST_ENDED_SESSION_ID, KEYS.LAST_ENDED_SESSION_DATE]);
  },

  // --- Full app data clear (removes URL + all data) ---
  clearAllAppData: async () => {
    const allKeys = await AsyncStorage.getAllKeys();
    // Remove all keys that start with 'af_'
    const appKeys = allKeys.filter(k => k.startsWith('af_'));
    if (appKeys.length > 0) {
      await AsyncStorage.multiRemove(appKeys);
    }
  },

  // --- Offline SMS Logs (queued while offline, synced when online) ---
  addOfflineSmsLog: async (log: OfflineSmsLog) => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_SMS_LOGS);
      const queue: OfflineSmsLog[] = raw ? JSON.parse(raw) : [];
      // Dedup: if a log with the same ID already exists, skip (don't add duplicate)
      const exists = queue.some((l) => l.id === log.id);
      if (exists) {
        console.log('[Storage] SMS log already exists, skipping:', log.id);
        return;
      }
      queue.push(log);
      await AsyncStorage.setItem(KEYS.OFFLINE_SMS_LOGS, JSON.stringify(queue));
    } catch (e) {
      console.error('[Storage] Failed to add offline SMS log:', e);
    }
  },

  getOfflineSmsLogs: async (): Promise<OfflineSmsLog[]> => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_SMS_LOGS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  removeFromOfflineSmsLogs: async (ids: string[]) => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_SMS_LOGS);
      const queue: OfflineSmsLog[] = raw ? JSON.parse(raw) : [];
      const filtered = queue.filter((l) => !ids.includes(l.id));
      await AsyncStorage.setItem(KEYS.OFFLINE_SMS_LOGS, JSON.stringify(filtered));
    } catch (e) {
      console.error('[Storage] Failed to remove offline SMS logs:', e);
    }
  },

  clearOfflineSmsLogs: async () => {
    try {
      await AsyncStorage.setItem(KEYS.OFFLINE_SMS_LOGS, JSON.stringify([]));
    } catch {}
  },

  // --- Overdue Shops (cached locally for offline access) ---
  saveOverdueShops: async (shops: OverdueShop[]) => {
    try {
      await AsyncStorage.setItem(KEYS.OVERDUE_SHOPS, JSON.stringify(shops));
    } catch (e) {
      console.error('[Storage] Failed to save overdue shops:', e);
    }
  },

  getOverdueShops: async (): Promise<OverdueShop[]> => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OVERDUE_SHOPS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  clearOverdueShops: async () => {
    try {
      await AsyncStorage.removeItem(KEYS.OVERDUE_SHOPS);
    } catch {}
  },

  // --- Business Name (cached from CMS for receipts) ---
  saveBusinessName: async (name: string) => {
    try {
      await AsyncStorage.setItem(KEYS.BUSINESS_NAME, name);
    } catch {}
  },

  getBusinessName: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(KEYS.BUSINESS_NAME);
    } catch {
      return null;
    }
  },
};
