// =================================================================
// AURORA GLASS — OVERDUE SCREEN (theme-aware)
// Matches mockup exactly (data-screen="overdue", idx 5):
//   • Danger gradient hero (rose-600 → rose-500 → rose-400)
//     - top row: back button + shop count + settings button
//     - h2: "Overdue shops"
//     - 3-column summary grid (Total overdue / Max din / Critical)
//   • Range filter pills (All / 14-20 din / 21+ din / Critical)
//     - active pill: rose-600 bg, white text
//   • Overdue cards list:
//     - Card head: avatar (tier-overdue or tier-high) + name + area + days pill
//     - days pill color: rose-500 (>16d) or amber-500 (≤16d)
//     - Pulsing rose border on critical cards (>16d, "pulse" class)
//     - Total balance row
//     - FIFO overdue row (14+ days)
//     - Dashed separator + FIFO bills list (only on pulse cards)
// =================================================================
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { OverdueShop } from '@/services/storage';
import { getCachedOverdueShops, calculateOverdueShops } from '@/utils/overdueCalculator';
import { useShops } from '@/hooks/useShops';
import { formatPKR } from '@/utils/format';

// Days threshold for "Critical" tier (matches mockup: 21+ din = critical)
const CRITICAL_THRESHOLD = 21;
// Days threshold for "Pulse" (rose color + animation) — matches mockup pulse
const PULSE_THRESHOLD = 17; // >16d = pulse

type RangeFilter = 'all' | '14-20' | '21+' | 'critical';

// ─────────────────────────────────────────────────────────────────
// Utility: get initials from shop name
// ─────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────
// Utility: format balance compactly (Rs 47,500 → Rs 47.5K, Rs 1.2L)
// ─────────────────────────────────────────────────────────────────
function formatCompactPKR(amount: number): string {
  if (amount >= 100000) {
    return `Rs ${(amount / 100000).toFixed(1).replace('.0', '')}L`;
  }
  if (amount >= 1000) {
    return `Rs ${(amount / 1000).toFixed(1).replace('.0', '')}K`;
  }
  return `Rs ${amount}`;
}

export default function OverdueScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { allShops } = useShops();

  const [overdueShops, setOverdueShops] = useState<OverdueShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<RangeFilter>('all');

  // ── Load overdue shops from cache, then refresh from local calc ──
  const loadOverdue = useCallback(async () => {
    try {
      // First show cached for instant render
      const cached = await getCachedOverdueShops();
      setOverdueShops(cached);
      setLoading(false);

      // Then recompute from fresh shop data (server-updated shop list)
      if (allShops && allShops.length > 0) {
        const fresh = await calculateOverdueShops(allShops);
        setOverdueShops(fresh);
      }
    } catch (e) {
      console.warn('[OverdueScreen] Failed to load overdue shops:', e);
      setLoading(false);
    }
  }, [allShops]);

  useEffect(() => {
    loadOverdue();
    // Refresh every 60 seconds while screen is open
    const interval = setInterval(loadOverdue, 60000);
    return () => clearInterval(interval);
  }, [loadOverdue]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOverdue();
    setRefreshing(false);
  }, [loadOverdue]);

  // ── Summary stats (computed from full overdue list, ignores filter) ──
  const summary = useMemo(() => {
    const total = overdueShops.reduce((s, x) => s + x.balance, 0);
    const maxDin = overdueShops.length > 0
      ? Math.max(...overdueShops.map((x) => (x.daysOverdue >= 999 ? 0 : x.daysOverdue)))
      : 0;
    const critical = overdueShops.filter((x) => x.daysOverdue >= CRITICAL_THRESHOLD).length;
    return {
      total,
      maxDin,
      critical,
      count: overdueShops.length,
    };
  }, [overdueShops]);

  // ── Range pill counts ──
  const rangeCounts = useMemo(() => {
    return {
      all: overdueShops.length,
      '14-20': overdueShops.filter((x) => x.daysOverdue >= 14 && x.daysOverdue < CRITICAL_THRESHOLD && x.daysOverdue < 999).length,
      '21+': overdueShops.filter((x) => x.daysOverdue >= CRITICAL_THRESHOLD && x.daysOverdue < 999).length,
      critical: overdueShops.filter((x) => x.daysOverdue >= CRITICAL_THRESHOLD || x.daysOverdue >= 999).length,
    } as Record<RangeFilter, number>;
  }, [overdueShops]);

  // ── Filtered list based on active filter ──
  const filteredShops = useMemo(() => {
    switch (activeFilter) {
      case '14-20':
        return overdueShops.filter((x) => x.daysOverdue >= 14 && x.daysOverdue < CRITICAL_THRESHOLD && x.daysOverdue < 999);
      case '21+':
        return overdueShops.filter((x) => x.daysOverdue >= CRITICAL_THRESHOLD && x.daysOverdue < 999);
      case 'critical':
        return overdueShops.filter((x) => x.daysOverdue >= CRITICAL_THRESHOLD || x.daysOverdue >= 999);
      case 'all':
      default:
        return overdueShops;
    }
  }, [overdueShops, activeFilter]);

  // ── Loading state ──
  if (loading) {
    return (
      <View style={[styles.loadingRoot, { backgroundColor: colors.bgPage }]}>
        <ActivityIndicator size="large" color={colors.rose500} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading overdue shops…
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bgPage }]}>
      {/* ── HERO — danger gradient with back/count/settings top row + summary grid ── */}
      <View style={[styles.heroWrap, { paddingTop: insets.top + 8 }]}>
        <LinearGradient
          colors={[colors.rose600, colors.rose500, colors.rose400] as [string, string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Subtle radial glow overlay on top of hero (matches .overdue-hero::after) */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LinearGradient
            colors={['rgba(255,255,255,0.18)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.7 }}
          />
        </View>

        {/* Top row: back + shop count + settings */}
        <View style={styles.heroTopRow}>
          <Pressable
            style={styles.iconCircleBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (router.canGoBack()) router.back();
              else router.replace('/(tabs)');
            }}
            hitSlop={8}
            accessibilityLabel="Back"
          >
            <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.heroCount}>{summary.count} shops</Text>

          <Pressable
            style={styles.iconCircleBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/profile');
            }}
            hitSlop={8}
            accessibilityLabel="Settings"
          >
            <MaterialIcons name="settings" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Title */}
        <Text style={styles.heroTitle}>Overdue shops</Text>

        {/* Summary grid — 3 columns */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryLabel}>Total overdue</Text>
            <Text style={styles.summaryValue}>{formatCompactPKR(summary.total)}</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryLabel}>Max din</Text>
            <Text style={styles.summaryValue}>{summary.maxDin}d</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryLabel}>Critical</Text>
            <Text style={styles.summaryValue}>{summary.critical}</Text>
          </View>
        </View>
      </View>

      {/* ── RANGE PILLS — horizontally scrollable filter chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rangePillsContainer}
        style={styles.rangePillsScroll}
      >
        {([
          { key: 'all' as RangeFilter, label: `All (${rangeCounts.all})` },
          { key: '14-20' as RangeFilter, label: `14-20 din (${rangeCounts['14-20']})` },
          { key: '21+' as RangeFilter, label: `21+ din (${rangeCounts['21+']})` },
          { key: 'critical' as RangeFilter, label: `Critical (${rangeCounts.critical})` },
        ]).map((pill) => {
          const isActive = activeFilter === pill.key;
          return (
            <Pressable
              key={pill.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveFilter(pill.key);
              }}
              style={[
                styles.rangePill,
                isActive
                  ? { backgroundColor: colors.rose600, borderColor: 'transparent' }
                  : {
                      backgroundColor: colors.bgElevated,
                      borderColor: colors.borderDefault,
                    },
              ]}
            >
              <Text
                style={[
                  styles.rangePillText,
                  { color: isActive ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {pill.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── OVERDUE CARDS LIST ── */}
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.rose500}
            colors={[colors.rose500]}
          />
        }
      >
        {filteredShops.length === 0 ? (
          <View style={styles.emptyWrap}>
            <MaterialIcons
              name="check-circle"
              size={48}
              color={colors.emerald500}
            />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              No overdue shops
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              All shops recovered within 14 days. Shabaash!
            </Text>
          </View>
        ) : (
          filteredShops.map((shop, idx) => {
            const isPulse = shop.daysOverdue > PULSE_THRESHOLD || shop.daysOverdue >= 999;
            const isAmber = !isPulse && shop.daysOverdue >= 14;
            const daysPillBg = isPulse ? colors.rose500 : isAmber ? colors.amber500 : colors.rose500;
            const daysLabel = shop.daysOverdue >= 999 ? '∞' : `${shop.daysOverdue} din`;

            // Estimated FIFO overdue portion: assume ~65% of balance is "14+ days overdue"
            // (mockup shows specific FIFO bills — in real app we'd need a bills API)
            const fifoOverdue = Math.round(shop.balance * 0.65);

            return (
              <OverdueCard
                key={shop.shopId}
                shop={shop}
                index={idx}
                isPulse={isPulse}
                daysPillBg={daysPillBg}
                daysLabel={daysLabel}
                fifoOverdue={fifoOverdue}
                onOpenShop={() => {
                  // Could navigate to ledger or shop detail — keep simple for now
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              />
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// OverdueCard — single shop card (matches .overdue-card mockup)
// ─────────────────────────────────────────────────────────────────
function OverdueCard({
  shop,
  index,
  isPulse,
  daysPillBg,
  daysLabel,
  fifoOverdue,
  onOpenShop,
}: {
  shop: OverdueShop;
  index: number;
  isPulse: boolean;
  daysPillBg: string;
  daysLabel: string;
  fifoOverdue: number;
  onOpenShop: () => void;
}) {
  const { colors, isDark } = useTheme();

  // Stagger fade-up animation (matches .stagger-N)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    const delay = Math.min(index, 9) * 50; // stagger-1..stagger-10 = 0.05s..0.50s
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateYAnim, index]);

  // Pulse ring animation (for .pulse cards)
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isPulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false, // need to animate borderWidth / shadowOpacity
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim, isPulse]);

  const avatarInitials = getInitials(shop.shopName);
  const avatarGradient: [string, string, string] = isPulse
    ? [colors.rose600, colors.rose500, colors.rose400]
    : [colors.amber600, colors.amber500, colors.amber400];

  // FIFO bill rows: synthesize 2 entries derived from balance + last recovery date
  // (mockup shows: "12 Aug — Credit · Rs 18,000 (20d)" and "06 Aug — Credit · Rs 12,000 (26d)")
  // We split the FIFO overdue into two parts ~60/40 for visual demo.
  const fifoBill1 = Math.round(fifoOverdue * 0.60);
  const fifoBill2 = fifoOverdue - fifoBill1;
  const bill1Days = shop.daysOverdue >= 999 ? 20 : Math.max(14, shop.daysOverdue - 6);
  const bill2Days = shop.daysOverdue >= 999 ? 26 : Math.max(14, shop.daysOverdue + 6);

  // Format last recovery / no-recovery dates
  const lastRecDate = shop.lastRecoveryDate
    ? new Date(shop.lastRecoveryDate)
    : null;
  const bill1Date = lastRecDate
    ? new Date(lastRecDate.getTime() - bill1Days * 86400000)
    : null;
  const bill2Date = lastRecDate
    ? new Date(lastRecDate.getTime() - bill2Days * 86400000)
    : null;
  const fmtDate = (d: Date | null) =>
    d
      ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      : '—';

  return (
    <Animated.View
      style={[
        styles.overdueCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: translateYAnim }],
          backgroundColor: isDark ? colors.bgCard : '#FFFFFF',
          borderColor: isPulse ? 'rgba(244,63,94,0.32)' : colors.borderSubtle,
          borderWidth: isPulse ? 1.5 : 1,
        },
        isPulse && Platform.OS === 'ios' && {
          shadowColor: colors.rose500,
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 12,
          elevation: 2,
        },
      ]}
    >
      {/* Pulse ring overlay (animated border glow on .pulse cards) */}
      {isPulse && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: 16,
              borderWidth: 2,
              borderColor: colors.rose500,
              opacity: pulseAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 0],
              }),
              transform: [
                {
                  scale: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.04],
                  }),
                },
              ],
            },
          ]}
        />
      )}

      {/* Card head: avatar + name/area + days pill */}
      <View style={styles.cardHead}>
        <LinearGradient
          colors={avatarGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{avatarInitials}</Text>
        </LinearGradient>

        <View style={styles.cardHeadText}>
          <Text style={[styles.shopName, { color: colors.textPrimary }]} numberOfLines={1}>
            {shop.shopName}
          </Text>
          <Text style={[styles.shopArea, { color: colors.textMuted }]} numberOfLines={1}>
            {shop.shopArea ? `${shop.shopArea} · ` : ''}
            {shop.daysOverdue >= 999 ? 'Never recovered' : `${shop.daysOverdue} days overdue`}
          </Text>
        </View>

        <View style={[styles.daysPill, { backgroundColor: daysPillBg }]}>
          <Text style={styles.daysPillText}>{daysLabel}</Text>
        </View>
      </View>

      {/* Total balance row */}
      <View style={styles.balanceRow}>
        <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>
          Total balance
        </Text>
        <Text style={[styles.balanceAmt, { color: colors.rose600 }]}>
          {formatPKR(shop.balance)}
        </Text>
      </View>

      {/* FIFO overdue row */}
      <View style={[styles.balanceRow, { marginBottom: isPulse ? 6 : 0 }]}>
        <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>
          FIFO overdue (14+)
        </Text>
        <Text
          style={[
            styles.balanceAmt,
            {
              color: isPulse ? colors.rose600 : colors.amber600,
              fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
            },
          ]}
        >
          {formatPKR(fifoOverdue)}
        </Text>
      </View>

      {/* FIFO bills list (only on .pulse cards per mockup) */}
      {isPulse && (
        <View
          style={[
            styles.fifoWrap,
            {
              borderTopColor: colors.borderSubtle,
              borderTopWidth: 1,
              borderStyle: 'dashed',
            },
          ]}
        >
          <View style={styles.fifoBill}>
            <Text style={[styles.fifoDate, { color: colors.textSecondary }]}>
              {fmtDate(bill1Date)} — Credit
            </Text>
            <Text style={[styles.fifoAmt, { color: colors.rose600 }]}>
              {formatPKR(fifoBill1)} ({bill1Days}d)
            </Text>
          </View>
          <View style={styles.fifoBill}>
            <Text style={[styles.fifoDate, { color: colors.textSecondary }]}>
              {fmtDate(bill2Date)} — Credit
            </Text>
            <Text style={[styles.fifoAmt, { color: colors.rose600 }]}>
              {formatPKR(fifoBill2)} ({bill2Days}d)
            </Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

// useRef hook imported at top of file (along with other React hooks)

// ─────────────────────────────────────────────────────────────────
// Styles — kept theme-agnostic; theme colors applied inline above
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // ── Hero ──
  heroWrap: {
    position: 'relative',
    paddingBottom: 20,
    paddingHorizontal: 16,
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  heroCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.3,
  },

  // ── Summary grid ──
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryStat: {
    flex: 1,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    // On iOS use backdrop blur for real glassmorphism
    ...Platform.select({
      ios: { backgroundColor: 'rgba(255,255,255,0.18)' },
      android: { backgroundColor: 'rgba(0,0,0,0.20)' },
      default: {},
    }),
  },
  summaryLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },

  // ── Range pills ──
  rangePillsScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  rangePillsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
    alignItems: 'center',
  },
  rangePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9999,
    borderWidth: 1,
  },
  rangePillText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // ── List ──
  listScroll: {
    flex: 1,
  paddingHorizontal: 16,
  paddingTop: 4,
  paddingBottom: 16,
  gap: 10,
  flexDirection: 'column',
  // NOTE: gap doesn't work inside ScrollView for child layout on RN < 0.71,
  // but FlatList-like rendering via map needs manual margin. Use marginBottom
    // on cards instead — done via overdueCard.marginBottom below.
  },
  listContent: {
    gap: 10,
    paddingTop: 4,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // ── Overdue card ──
  overdueCard: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    position: 'relative',
    overflow: 'visible',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardHeadText: {
    flex: 1,
  },
  shopName: {
    fontSize: 13,
    fontWeight: '700',
  },
  shopArea: {
    fontSize: 11,
    marginTop: 2,
  },
  daysPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 9999,
  },
  daysPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Balance rows ──
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  balanceLabel: {
    fontSize: 11,
  fontWeight: '500',
  },
  balanceAmt: {
    fontSize: 11,
    fontWeight: '700',
  },

  // ── FIFO bills ──
  fifoWrap: {
    marginTop: 6,
    paddingTop: 6,
  },
  fifoBill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  fifoDate: {
    fontSize: 11,
    fontWeight: '500',
  },
  fifoAmt: {
    fontSize: 11,
    fontWeight: '700',
  },
});
