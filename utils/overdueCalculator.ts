// utils/overdueCalculator.ts
// Calculates overdue shops locally from shop data + last recovery dates.
// A shop is "overdue" if:
//   1. Balance > 0 (has outstanding amount)
//   2. Last approved recovery was 14+ days ago (or never recovered)
// This means: if a shop got credit today but no recovery in 14+ days, it's overdue.
// If recovery happened within 14 days, it's NOT overdue (even with balance > 0).

import { Shop } from '@/services/api';
import { OverdueShop } from '@/services/storage';
import { StorageService } from '@/services/storage';

const OVERDUE_THRESHOLD_DAYS = 14;

/**
 * Calculate overdue shops from locally saved shop data.
 * Uses ShopLastRecovery dates stored in AsyncStorage.
 *
 * @param shops - All shops for this orderbooker
 * @returns Array of overdue shops sorted by days overdue (most overdue first)
 */
export async function calculateOverdueShops(shops: Shop[]): Promise<OverdueShop[]> {
  if (!shops || shops.length === 0) return [];

  const lastRecoveryDates = await StorageService.getLastRecoveryDates();
  const now = Date.now();
  const thresholdMs = OVERDUE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  const overdueShops: OverdueShop[] = [];

  for (const shop of shops) {
    // Skip shops with no balance
    const balance = Number(shop.balance || 0);
    if (balance <= 0) continue;

    // Find last recovery date for this shop
    const recoveryEntry = lastRecoveryDates.find((r) => r.shopId === shop.id);
    const lastRecoveryDate = recoveryEntry?.lastRecoveryDate || null;

    let daysOverdue = 0;
    let isOverdue = false;

    if (!lastRecoveryDate) {
      // Never recovered — check if shop was created 14+ days ago
      // If shop has balance and never recovered, it's overdue
      // (we don't know exact creation date, but if balance > 0 and no recovery, likely overdue)
      daysOverdue = 999; // Never recovered = very overdue
      isOverdue = true;
    } else {
      const recoveryTime = new Date(lastRecoveryDate).getTime();
      const diffMs = now - recoveryTime;
      daysOverdue = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      // Only overdue if 14+ days since last recovery
      isOverdue = daysOverdue >= OVERDUE_THRESHOLD_DAYS;
    }

    // Only include if overdue (14+ days since last recovery) AND balance > 0
    if (isOverdue) {
      overdueShops.push({
        shopId: shop.id,
        shopName: shop.name,
        shopArea: shop.area || null,
        balance,
        lastRecoveryDate,
        daysOverdue,
      });
    }
  }

  // Sort: most overdue first (999 = never recovered, then by days descending)
  overdueShops.sort((a, b) => b.daysOverdue - a.daysOverdue);

  // Save to local storage for offline access
  await StorageService.saveOverdueShops(overdueShops);

  return overdueShops;
}

/**
 * Get cached overdue shops from local storage (for offline mode).
 */
export async function getCachedOverdueShops(): Promise<OverdueShop[]> {
  return StorageService.getOverdueShops();
}

/**
 * Check if a specific shop is overdue (for shop list badge).
 * Uses cached overdue shops data.
 */
export async function isShopOverdue(shopId: string): Promise<boolean> {
  const overdue = await StorageService.getOverdueShops();
  return overdue.some((s) => s.shopId === shopId);
}

/**
 * Get set of overdue shop IDs (for efficient lookup in shop list rendering).
 */
export async function getOverdueShopIds(): Promise<Set<string>> {
  const overdue = await StorageService.getOverdueShops();
  return new Set(overdue.map((s) => s.shopId));
}
