// Finexa Recovery App
// ShopCard — AURORA GLASS design (mockup screen 3 "Shops"):
// glass row + 42px tier-coloured avatar + edge tags + right-aligned mono
// balance. Action strip (Collect / GPS / Call / Detail) preserved.
import React, { memo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AURORA, Colors, Spacing, Radius, FontSize, FontWeight, Shadow, FontMono } from '@/constants/theme';
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
  isOverdue?: boolean; // Whether this shop is overdue (oldest unpaid bill 14+ days old — FIFO)
  onCollect: () => void;
  onPress: () => void;
  onGpsVisit?: () => void;
  companyId?: string;
}

// Aurora tier gradients (mockup .tier-overdue/.tier-high/.tier-mid/.tier-low)
function getTierColors(balance: number, isOverdue: boolean): [string, string] {
  if (isOverdue) return ['#E11D48', '#F43F5E']; // tier-overdue (rose-600)
  if (balance > 50000) return ['#F43F5E', '#FB7185']; // tier-high (rose-500)
  if (balance >= 10000) return ['#F59E0B', '#FBBF24']; // tier-mid (amber-500)
  return ['#10B981', '#34D399']; // tier-low (emerald-500)
}

// Balance text colour (mockup: rose for overdue/high, amber-600 for mid-high, emerald-600 low)
function getBalanceColor(balance: number, isOverdue: boolean): string {
  if (isOverdue || balance > 50000) return '#E11D48';
  if (balance >= 10000) return '#D97706';
  return '#059669';
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
  const balanceColor = getBalanceColor(displayBalance, isOverdue);
  const tierColors = getTierColors(displayBalance, isOverdue);
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

  // Edge tag (mockup .edge-tag): 9px pill under the shop area
  let edgeTag: { text: string; bg: string; fg: string } | null = null;
  if (isOverdue) {
    edgeTag = { text: '⏰ Overdue', bg: AURORA.chipDangerBg, fg: AURORA.chipDangerText };
  } else if (hasRecovery) {
    edgeTag = { text: '✓ Recovered', bg: AURORA.chipSuccessBg, fg: AURORA.chipSuccessText };
  } else if (isVisited) {
    edgeTag = { text: '✓ Aaj visit', bg: AURORA.chipSuccessBg, fg: AURORA.chipSuccessText };
  } else if (isZeroBalance) {
    edgeTag = { text: '✓ Clear', bg: AURORA.chipSuccessBg, fg: AURORA.chipSuccessText };
  } else if (displayBalance > 50000) {
    edgeTag = { text: '💰 High balance', bg: AURORA.chipWarningBg, fg: AURORA.chipWarningText };
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          isZeroBalance && !hasRecovery && styles.cardZero,
          pressed && styles.cardPressed,
        ]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        android_ripple={{ color: 'rgba(99,102,241,0.06)', borderless: true, radius: 240 }}
      >
        {/* ============ MAIN ROW (mockup .shop-row) ============ */}
        <View style={styles.mainRow}>
          {/* LEFT — tier avatar 42px + 2-letter initials (mockup .shop-avatar) */}
          <LinearGradient
            colors={tierColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            {hasRecovery ? (
              <MaterialIcons name="check" size={20} color="#FFFFFF" />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </LinearGradient>

          {/* MIDDLE — name + route pill / owner / address / edge tag (mockup .shop-meta) */}
          <View style={styles.infoCol}>
            <View style={styles.nameRow}>
              <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
              {routeDayLabel ? (
                <View style={styles.routePill}>
                  <MaterialIcons name="event" size={9} color={AURORA.chipText} />
                  <Text style={styles.routePillText}>{routeDayLabel}</Text>
                </View>
              ) : null}
            </View>
            {shop.ownerName ? (
              <Text style={styles.ownerName} numberOfLines={1}>{shop.ownerName}</Text>
            ) : null}
            {(shop.address || shop.area) ? (
              <View style={styles.addressRow}>
                <MaterialIcons name="location-on" size={11} color={Colors.textMuted} />
                <Text style={styles.addressText} numberOfLines={1}>{shop.address || shop.area}</Text>
              </View>
            ) : null}
            {edgeTag ? (
              <View style={[styles.edgeTag, { backgroundColor: edgeTag.bg }]}>
                <Text style={[styles.edgeTagText, { color: edgeTag.fg }]}>{edgeTag.text}</Text>
              </View>
            ) : null}
          </View>

          {/* RIGHT — balance label above mono value (mockup .shop-balance) */}
          <View style={styles.rightCol}>
            <Text style={styles.balanceLabel}>Balance</Text>
            <Text style={[styles.balanceValue, { color: balanceColor }]} numberOfLines={1}>
              {formatPKR(displayBalance)}
            </Text>
          </View>
        </View>

        {/* ============ STATUS BANNER (over limit only) ============ */}
        {isOverLimit ? (
          <View style={styles.bannerRow}>
            <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulseAnim }] }]} />
            <MaterialIcons name="warning" size={12} color={AURORA.chipDangerText} />
            <Text style={styles.bannerText}>Over credit limit by {formatPKR(displayBalance - displayCreditLimit)}</Text>
          </View>
        ) : null}

        {/* ============ CREDIT UTILISATION THIN BAR ============ */}
        {displayCreditLimit > 0 ? (
          <View style={styles.creditSection}>
            <View style={styles.creditTrack}>
              <LinearGradient
                colors={
                  isOverLimit
                    ? ['#E11D48', '#FB7185']
                    : rawUtilisation >= 90
                    ? ['#F59E0B', '#FBBF24']
                    : ['#4F46E5', '#818CF8']
                }
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
              {isZeroBalance ? (
                <View style={styles.collectChipGradient}>
                  <MaterialIcons name="payments" size={14} color={Colors.textMuted} />
                  <Text style={[styles.collectChipText, { color: Colors.textMuted }]}>No Balance</Text>
                </View>
              ) : (
                <LinearGradient
                  colors={[...AURORA.brandGradient]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.collectChipGradient}
                >
                  <MaterialIcons name="payments" size={14} color="#FFFFFF" />
                  <Text style={styles.collectChipText}>Collect</Text>
                </LinearGradient>
              )}
            </Pressable>
          )}

          <View style={styles.iconActions}>
            <Pressable
              style={({ pressed }) => [styles.iconBtn, isVisited && styles.iconBtnActive, pressed && { opacity: 0.7 }]}
              onPress={onGpsVisit}
              hitSlop={6}
            >
              <MaterialIcons name={isVisited ? 'check-circle' : 'my-location'} size={16} color={isVisited ? AURORA.chipText : Colors.primary} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
              onPress={handleCall}
              hitSlop={6}
            >
              <MaterialIcons name="call" size={16} color={Colors.emerald} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
              onPress={onPress}
              hitSlop={6}
            >
              <MaterialIcons name="info-outline" size={16} color={Colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  // Glass card (mockup .shop-row: bg-card, subtle border, r-lg, shadow-xs)
  card: {
    backgroundColor: AURORA.bgCard,
    borderRadius: 16,
    padding: 12,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: AURORA.borderSubtle,
  },
  cardZero: {
    opacity: 0.78,
  },
  cardPressed: {
    // handled by Animated scale
  },
  // ===== Main row =====
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: FontWeight.extrabold,
    color: '#FFFFFF',
    letterSpacing: 0,
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
    fontSize: 13,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    flexShrink: 1,
  },
  routePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: AURORA.chipBg,
    borderWidth: 1,
    borderColor: AURORA.chipBorder,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  routePillText: {
    fontSize: 9,
    color: AURORA.chipText,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  ownerName: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  addressText: {
    fontSize: 11,
    color: Colors.textMuted,
    flex: 1,
  },
  // Edge tag (mockup .edge-tag)
  edgeTag: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 3,
  },
  edgeTagText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.2,
  },
  // ===== Right column (mockup .shop-balance) =====
  rightCol: {
    alignItems: 'flex-end',
    gap: 1,
    minWidth: 68,
  },
  balanceLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: FontWeight.bold,
    fontFamily: FontMono,
    letterSpacing: -0.3,
  },
  // ===== Banner =====
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: AURORA.chipDangerBg,
    borderWidth: 1,
    borderColor: AURORA.chipDangerBorder,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    marginTop: 10,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.rose,
  },
  bannerText: {
    fontSize: FontSize.xs,
    color: AURORA.chipDangerText,
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
    backgroundColor: AURORA.borderSubtle,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  creditFill: {
    height: 5,
    borderRadius: Radius.full,
  },
  creditMeta: {
    fontSize: 10,
    color: Colors.textMuted,
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
    borderTopColor: AURORA.borderSubtle,
  },
  collectChip: {
    flex: 1,
    borderRadius: Radius.full,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  collectChipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  collectChipDisabled: {
    backgroundColor: AURORA.bgElevated,
    borderWidth: 1,
    borderColor: AURORA.borderDefault,
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
    backgroundColor: Colors.emerald,
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
    borderWidth: 1,
    borderColor: AURORA.borderDefault,
    backgroundColor: AURORA.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    borderColor: AURORA.chipBorder,
    backgroundColor: AURORA.chipActiveBg,
  },
});
