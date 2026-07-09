// Finexa Recovery App
import React, { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { Shop, CompanyBalance } from '@/services/api';
import { formatPKR } from '@/utils/format';

// Helper: get display balance for a shop based on the user's assigned company
// Returns company-specific balance when companyId is provided and companyBalances exists.
// If companyBalances exists but the specific company isn't found, returns 0 (not total balance)
// to avoid showing wrong balance for multi-company setups.
export function getShopDisplayBalance(shop: Shop, companyId?: string): { balance: number; creditLimit: number } {
  try {
    if (companyId && shop.companyBalances && Array.isArray(shop.companyBalances) && shop.companyBalances.length > 0) {
      const companyBal = shop.companyBalances.find((cb: CompanyBalance) => cb && cb.companyId === companyId);
      if (companyBal && typeof companyBal.balance === 'number') {
        return { balance: companyBal.balance, creditLimit: companyBal.creditLimit || shop.creditLimit || 0 };
      }
      // companyBalances exists but this company not found — return 0, NOT total balance
      // This prevents showing wrong (total) balance for multi-company shops
      return { balance: 0, creditLimit: 0 };
    }
    // No companyBalances or no companyId — use shop's top-level balance (single-company / legacy)
    return { balance: shop.balance || 0, creditLimit: shop.creditLimit || 0 };
  } catch {
    return { balance: shop.balance || 0, creditLimit: shop.creditLimit || 0 };
  }
}

interface ShopCardProps {
  shop: Shop;
  isVisited: boolean;
  hasRecovery?: boolean; // Whether recovery has been submitted for this shop today
  isOverdue?: boolean; // Whether this shop is overdue (7+ days since last recovery)
  onCollect: () => void;
  onPress: () => void;
  onGpsVisit?: () => void;
  companyId?: string;
}

// Map a balance to its color tier per the modern design spec.
// Red > 50000, Amber 10000-50000, Green < 10000
function getBalanceColor(balance: number): string {
  if (balance > 50000) return '#EF4444';
  if (balance >= 10000) return '#F59E0B';
  return '#10B981';
}

// Build a short route-day label like "Mon, Thu" from the shop's routeDays array
function buildRouteDayLabel(shop: Shop): string | null {
  if (!shop.routeDays || shop.routeDays.length === 0) return null;
  const abbrev = shop.routeDays.map((d) => {
    const lower = String(d).toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1, 3);
  });
  return abbrev.join(', ');
}

// First two letters of the shop name for the avatar initials
function getShopInitials(name: string): string {
  if (!name) return '?';
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed.toUpperCase();
  return trimmed.substring(0, 2).toUpperCase();
}

export const ShopCard = memo(function ShopCard({
  shop,
  isVisited,
  hasRecovery = false,
  isOverdue = false,
  onCollect,
  onPress,
  onGpsVisit,
  companyId,
}: ShopCardProps) {
  const { balance: displayBalance, creditLimit: displayCreditLimit } = getShopDisplayBalance(shop, companyId);
  const isOverLimit = displayCreditLimit > 0 && displayBalance > displayCreditLimit;
  const rawUtilisation = displayCreditLimit > 0 ? (displayBalance / displayCreditLimit) * 100 : 0;
  const utilisation = Math.min(rawUtilisation, 100);
  const isZeroBalance = displayBalance === 0;
  const balanceColor = getBalanceColor(displayBalance);
  const routeDayLabel = buildRouteDayLabel(shop);
  const initials = getShopInitials(shop.name);

  // Press-scale animation for the whole card
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.timing(scaleAnim, { toValue: 0.98, duration: 120, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 14 }).start();
  };

  // Pulsing dot for over-limit banner
  // Pulse animation removed — was causing shop list blink
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const handleCall = () => {
    if (shop.phone) Linking.openURL(`tel:${shop.phone}`);
  };

  // Avatar gradient: solid blue when recovered/visited, lighter blue otherwise
  const avatarActive = hasRecovery || (isVisited && !hasRecovery);
  const avatarColors: [string, string] = avatarActive ? ['#3B82F6', '#1E40AF'] : ['#DBEAFE', '#93C5FD'];
  const avatarTextColor = avatarActive ? '#FFFFFF' : '#1E40AF';

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          hasRecovery && styles.cardRecovered,
          isVisited && !hasRecovery && styles.cardVisited,
          isZeroBalance && !hasRecovery && styles.cardZero,
          pressed && styles.cardPressed,
        ]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        android_ripple={{ color: 'rgba(37,99,235,0.06)', borderless: true, radius: 240 }}
      >
        {/* ============ MAIN HORIZONTAL ROW (matches mockup Screen 2) ============ */}
        <View style={styles.mainRow}>
          {/* LEFT — Avatar circle 46px with gradient + 2-letter initials */}
          <LinearGradient
            colors={avatarColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            {hasRecovery ? (
              <MaterialIcons name="check" size={22} color="#FFFFFF" />
            ) : (
              <Text style={[styles.avatarText, { color: avatarTextColor }]}>{initials}</Text>
            )}
          </LinearGradient>

          {/* MIDDLE — name + route badge / owner / address */}
          <View style={styles.infoCol}>
            {/* Row 1: shop name + route-day pill */}
            <View style={styles.nameRow}>
              <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
              {routeDayLabel ? (
                <View style={styles.routePill}>
                  <MaterialIcons name="event" size={9} color="#1E40AF" />
                  <Text style={styles.routePillText}>{routeDayLabel}</Text>
                </View>
              ) : null}
              {isOverdue ? (
                <View style={styles.overduePill}>
                  <MaterialIcons name="priority-high" size={8} color="#FFFFFF" />
                  <Text style={styles.overduePillText}>OVERDUE</Text>
                </View>
              ) : null}
            </View>

            {/* Row 2: owner name (muted) */}
            {shop.ownerName ? (
              <Text style={styles.ownerName} numberOfLines={1}>{shop.ownerName}</Text>
            ) : null}

            {/* Row 3: map-pin icon + address */}
            {(shop.address || shop.area) ? (
              <View style={styles.addressRow}>
                <MaterialIcons name="location-on" size={11} color="#94A3B8" />
                <Text style={styles.addressText} numberOfLines={1}>{shop.address || shop.area}</Text>
              </View>
            ) : null}
          </View>

          {/* RIGHT — balance + chevron */}
          <View style={styles.rightCol}>
            <Text style={[styles.balanceValue, { color: balanceColor }]} numberOfLines={1}>
              {formatPKR(displayBalance)}
            </Text>
            <Text style={styles.balanceLabel}>Balance</Text>
            {hasRecovery ? (
              <View style={styles.statusPillRecovered}>
                <MaterialIcons name="check-circle" size={9} color="#FFFFFF" />
                <Text style={styles.statusPillText}>Recovered</Text>
              </View>
            ) : isVisited ? (
              <View style={styles.statusPillVisited}>
                <MaterialIcons name="check-circle" size={9} color="#1E40AF" />
                <Text style={[styles.statusPillText, { color: '#1E40AF' }]}>Visited</Text>
              </View>
            ) : null}
            <MaterialIcons name="chevron-right" size={18} color="#94A3B8" style={styles.chevron} />
          </View>
        </View>

        {/* ============ STATUS BANNER (over limit only) ============ */}
        {isOverLimit ? (
          <View style={styles.bannerRow}>
            <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulseAnim }] }]} />
            <MaterialIcons name="warning" size={12} color="#EF4444" />
            <Text style={styles.bannerText}>Over credit limit by {formatPKR(displayBalance - displayCreditLimit)}</Text>
          </View>
        ) : null}

        {/* ============ CREDIT UTILISATION THIN BAR ============ */}
        {displayCreditLimit > 0 ? (
          <View style={styles.creditSection}>
            <View style={styles.creditTrack}>
              <LinearGradient
                colors={isOverLimit ? ['#EF4444', '#F87171'] : rawUtilisation >= 90 ? ['#F59E0B', '#FBBF24'] : ['#3B82F6', '#60A5FA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.creditFill, { width: `${utilisation}%` }]}
              />
            </View>
            <Text style={styles.creditMeta}>
              {utilisation.toFixed(0)}% · {formatPKR(displayBalance)} / {formatPKR(displayCreditLimit)}
            </Text>
          </View>
        ) : null}

        {/* ============ COMPACT ACTION STRIP (keeps onCollect / onGpsVisit / handleCall wired) ============ */}
        <View style={styles.actionStrip}>
          {hasRecovery ? (
            <View style={styles.doneChip}>
              <MaterialIcons name="check" size={13} color="#FFFFFF" />
              <Text style={styles.doneChipText}>Recovery Added</Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.collectChip, isZeroBalance && styles.collectChipDisabled, pressed && { opacity: 0.85 }]}
              onPress={onCollect}
              disabled={isZeroBalance}
              hitSlop={4}
            >
              <MaterialIcons name="payments" size={14} color={isZeroBalance ? '#94A3B8' : '#FFFFFF'} />
              <Text style={[styles.collectChipText, isZeroBalance && { color: '#94A3B8' }]}>
                {isZeroBalance ? 'No Balance' : 'Collect'}
              </Text>
            </Pressable>
          )}

          <View style={styles.iconActions}>
            <Pressable
              style={({ pressed }) => [styles.iconBtn, isVisited && styles.iconBtnActive, pressed && { opacity: 0.7 }]}
              onPress={onGpsVisit}
              hitSlop={6}
            >
              <MaterialIcons name={isVisited ? 'check-circle' : 'my-location'} size={16} color={isVisited ? '#1E40AF' : '#2563EB'} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
              onPress={handleCall}
              hitSlop={6}
            >
              <MaterialIcons name="call" size={16} color="#10B981" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
              onPress={onPress}
              hitSlop={6}
            >
              <MaterialIcons name="info-outline" size={16} color="#64748B" />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: Spacing.sm,
    ...Shadow.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardRecovered: {
    borderColor: '#2563EB',
    borderWidth: 1.5,
    backgroundColor: '#F8FAFC',
  },
  cardVisited: {
    borderColor: '#BFDBFE',
    borderWidth: 1.5,
  },
  cardZero: {
    opacity: 0.78,
  },
  cardPressed: {
    // handled by Animated scale
  },
  // ===== Main horizontal row =====
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.5,
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  shopName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    flexShrink: 1,
  },
  routePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#DBEAFE',
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  routePillText: {
    fontSize: 9,
    color: '#1E40AF',
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  overduePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#EF4444',
    borderRadius: Radius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  overduePillText: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  ownerName: {
    fontSize: FontSize.xs,
    color: '#64748B',
    fontWeight: FontWeight.medium,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  addressText: {
    fontSize: FontSize.xs,
    color: '#64748B',
    flex: 1,
  },
  // ===== Right column =====
  rightCol: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 72,
  },
  balanceValue: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  balanceLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statusPillRecovered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#2563EB',
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  statusPillVisited: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DBEAFE',
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  statusPillText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  chevron: {
    marginTop: 2,
  },
  // ===== Banner =====
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEE2E2',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    marginTop: 10,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  bannerText: {
    fontSize: FontSize.xs,
    color: '#EF4444',
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  // ===== Credit utilisation =====
  creditSection: {
    marginTop: 10,
    gap: 4,
  },
  creditTrack: {
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  creditFill: {
    height: 5,
    borderRadius: Radius.full,
  },
  creditMeta: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: FontWeight.medium,
  },
  // ===== Action strip =====
  actionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  collectChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    borderRadius: Radius.full,
    paddingVertical: 8,
    paddingHorizontal: 12,
    ...Shadow.sm,
  },
  collectChipDisabled: {
    backgroundColor: '#E2E8F0',
    elevation: 0,
    shadowOpacity: 0,
  },
  collectChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  doneChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    borderRadius: Radius.full,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  doneChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  iconActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    borderColor: '#BFDBFE',
    backgroundColor: '#DBEAFE',
  },
});
