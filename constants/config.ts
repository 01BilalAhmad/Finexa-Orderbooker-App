// Powered by Finexa
// DEFAULT_URL is used only if no custom URL is saved in AsyncStorage
export const DEFAULT_URL = 'https://alfalah-traders.vercel.app';

// Dynamic URL: call getApiUrl() instead of using API_BASE_URL directly
// This reads from AsyncStorage first, then falls back to DEFAULT_URL
let _cachedUrl: string | null = null;

export function getApiUrl(): string {
  if (_cachedUrl) return _cachedUrl;
  return DEFAULT_URL; // fallback until AsyncStorage loads
}

export function setCachedUrl(url: string) {
  _cachedUrl = url;
}

export function clearCachedUrl() {
  _cachedUrl = null;
}

// Working days for Finexa Recovery App (Pakistan schedule)
// Friday is the weekly off day. Saturday through Thursday are working days.
export const ROUTE_DAYS = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

export const DAY_NAMES: Record<number, string> = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
  0: 'sunday',
};

export const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];
export const MIN_RECOVERY = 1;
export const MAX_RECOVERY = 500000;
