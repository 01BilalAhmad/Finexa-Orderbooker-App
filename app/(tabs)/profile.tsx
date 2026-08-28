// Powered by Finexa
// Profile Screen — Screen 7 "Profile/Settings" redesign.
// Hero gradient header + overlapping stats cards + grouped settings rows
// (company assignments, sync status, notifications, offline mode, language,
// help, about) with all existing functionality preserved.
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Switch,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useShops } from '@/hooks/useShops';
import { useLock } from '@/hooks/useLock';
import { useRouteTracking } from '@/contexts/RouteTrackingContext';
import { ApiService } from '@/services/api';
import { StorageService } from '@/services/storage';
import { SecureStorageService } from '@/services/secureStorage';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { AuroraColors, AuroraGradients } from '@/constants/auroraTheme';
import { formatPKR, getTodayDateStr } from '@/utils/format';
import { RecoveryAnalysisChart } from '@/components/ui/RecoveryAnalysisChart';
import { RecoveryComparison } from '@/components/ui/RecoveryComparison';
import { PerformanceRanking } from '@/components/ui/PerformanceRanking';

const APP_VERSION = 'v2.4.1';

// ────────────────────────────────────────────────────────────────────────────
// Stat Card — small overlapping card with accent strip + icon
// ────────────────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  accent,
  accentSoft,
}: {
  label: string;
  value: string;
  icon: string;
  accent: string;
  accentSoft: string;
}) {
  return (
    <View style={[statStyles.card, { borderTopColor: accent }]}>
      <View style={[statStyles.iconBox, { backgroundColor: accentSoft }]}>
        <MaterialIcons name={icon as any} size={18} color={accent} />
      </View>
      <Text style={statStyles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={statStyles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderTopWidth: 3,
    ...Shadow.md,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  value: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Settings Row — flexible row used inside the Settings card
// ────────────────────────────────────────────────────────────────────────────
type SettingsRowProps = {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  danger?: boolean;
  isLast?: boolean;
};
function SettingsRow({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  rightElement,
  onPress,
  showChevron = false,
  danger = false,
  isLast = false,
}: SettingsRowProps) {
  const inner = (
    <View style={[rowStyles.row, isLast && rowStyles.rowLast]}>
      <View style={[rowStyles.iconBox, { backgroundColor: iconBg }]}>
        <MaterialIcons name={icon as any} size={20} color={iconColor} />
      </View>
      <View style={rowStyles.textWrap}>
        <Text style={[rowStyles.title, danger && { color: Colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={rowStyles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightElement ? (
        <View style={rowStyles.rightWrap}>{rightElement}</View>
      ) : showChevron ? (
        <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
      ) : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
      >
        {inner}
      </Pressable>
    );
  }
  return inner;
}
const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  rightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Section Header (small uppercase label above grouped cards)
// ────────────────────────────────────────────────────────────────────────────
function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={sectionLabelStyles.wrap}>
      <View style={sectionLabelStyles.iconBox}>
        <MaterialIcons name={icon as any} size={14} color="#2563EB" />
      </View>
      <Text style={sectionLabelStyles.text}>{label}</Text>
    </View>
  );
}
const sectionLabelStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, updatePhone, companies, selectedCompanyId } = useAuth();
  const { allShops } = useShops();
  const { setNeedsPinSetup, lock } = useLock();
  const { isTracking, isStarting, isStopping, startRoute, endRoute, startTime, error: routeError } = useRouteTracking();

  const [loggingOut, setLoggingOut] = useState(false);
  const [todayRecovery, setTodayRecovery] = useState(0);
  const [thisMonthRecovery, setThisMonthRecovery] = useState(0);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Phone edit state
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const phoneInputRef = useRef<TextInput>(null);

  // Local UI preferences (mockup-style toggles)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>('2 min ago');

  useEffect(() => {
    if (user) loadStats();
  }, [user]);

  async function loadStats() {
    if (!user) return;
    try {
      const today = await ApiService.getRecoverySummary(getTodayDateStr());
      const myToday = today.orderbookers.find((ob) => ob.orderbookerId === user.id);
      if (myToday) setTodayRecovery(myToday.totalRecovery);

      const now = new Date();
      const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const monthTxns = await ApiService.getTransactions({
        createdBy: user.id,
        type: 'recovery',
        date: firstOfMonth,
        limit: 500,
      });
      setThisMonthRecovery(monthTxns.transactions.reduce((sum, t) => sum + t.amount, 0));
    } catch { /* not critical */ }
  }

  const handleSavePhone = async () => {
    const trimmed = phoneInput.trim();
    if (trimmed && !/^[\d+\-\s()]{7,15}$/.test(trimmed)) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number (7-15 digits)');
      return;
    }
    setIsSavingPhone(true);
    try {
      await updatePhone(trimmed);
      setIsEditingPhone(false);
      setPhoneInput('');
      Alert.alert('Phone Updated', trimmed ? `Phone number updated to ${trimmed}` : 'Phone number removed');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update phone number');
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleLogout = () => {
    // If route is active, warn user first
    if (isTracking) {
      Alert.alert(
        'Active Route Detected',
        'You have an active route session. Logging out will stop route tracking. Do you want to end the route and logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'End Route & Logout',
            style: 'destructive',
            onPress: async () => {
              setLoggingOut(true);
              try {
                await endRoute();
              } catch {}
              try {
                await logout();
                await SecureStorageService.clearAll();
                setTimeout(() => {
                  router.replace('/');
                }, 100);
              } finally {
                setLoggingOut(false);
              }
            },
          },
        ]
      );
      return;
    }

    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
            await SecureStorageService.clearAll();
            router.replace('/login' as any);
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const handleChangePin = () => {
    Alert.alert('Change PIN', 'Do you want to change your PIN? You will need to set a new one.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Change PIN',
        onPress: async () => {
          await SecureStorageService.clearPin();
          setNeedsPinSetup(true);
          lock();
        },
      },
    ]);
  };

  const handleSyncUpload = () => {
    Alert.alert(
      'Sync Upload',
      'Sab pending data (recoveries, GPS, route) server par upload karein?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upload',
          onPress: async () => {
            try {
              const { performSyncUpload } = await import('@/services/syncUpload');
              const result = await performSyncUpload();
              setLastSyncedAt('just now');
              if (result.success) {
                Alert.alert(
                  'Sync Complete',
                  `Route: ${result.routeUploaded ? '✓' : '-'}\nGPS Points: ${result.locationsUploaded}\nTransactions: ${result.transactionsSynced}\nFailed: ${result.transactionsFailed}`
                );
              } else {
                Alert.alert('Sync Failed', result.error || 'Upload nahi ho saka. Dobarra try karein.');
              }
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Sync failed');
            }
          },
        },
      ]
    );
  };

  const handleClearAppData = () => {
    Alert.alert(
      '⚠️ Clear All Data',
      'YE SAB DATA DELETE HO JAYEGA:\n• Downloaded shops\n• Offline recoveries\n• GPS waypoints\n• Saved URL\n\nKya aap sure hain?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            await StorageService.clearAllAppData();
            const { clearCachedUrl } = await import('@/constants/config');
            clearCachedUrl();
            await logout();
            router.replace('/setup-url' as any);
          },
        },
      ]
    );
  };

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Stats values
  const totalShops = String(allShops.length);
  const monthRecoveryDisplay =
    thisMonthRecovery >= 1000000
      ? `Rs. ${(thisMonthRecovery / 1000000).toFixed(1)}M`
      : thisMonthRecovery >= 1000
      ? `Rs. ${(thisMonthRecovery / 1000).toFixed(0)}K`
      : formatPKR(thisMonthRecovery);
  const avgPerDay = thisMonthRecovery > 0
    ? `Rs. ${(thisMonthRecovery / Math.max(1, new Date().getDate())).toFixed(0)}`
    : 'Rs. 0';

  // Company badges for the right side of "Company Assignments" row
  const renderCompanyBadges = () => {
    if (companies.length === 0) {
      return (
        <View style={styles.badgePillSoft}>
          <Text style={styles.badgePillTextMuted}>N/A</Text>
        </View>
      );
    }
    return (
      <View style={styles.companyBadgeRow}>
        {companies.slice(0, 3).map((c, idx) => {
          const isActive = c.companyId === selectedCompanyId;
          return (
            <View
              key={c.companyId || idx}
              style={[styles.badgePill, isActive ? styles.badgePillActive : styles.badgePillSoft]}
            >
              <Text
                style={[
                  styles.badgePillText,
                  isActive ? styles.badgePillTextActive : styles.badgePillTextMuted,
                ]}
                numberOfLines={1}
              >
                {(c.companyName || 'Co').slice(0, 8)}
              </Text>
            </View>
          );
        })}
        {companies.length > 3 ? (
          <View style={styles.badgePillSoft}>
            <Text style={styles.badgePillTextMuted}>+{companies.length - 3}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* ─────────────────────────────────────────────────────────────── */}
        {/* HERO HEADER — blue gradient with bubbles, avatar, name, badges  */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <LinearGradient
          colors={[...AuroraGradients.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroBubble1} pointerEvents="none" />
          <View style={styles.heroBubble2} pointerEvents="none" />
          <View style={styles.heroBubble3} pointerEvents="none" />

          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.avatarRingDot} />
          </View>

          {/* Name */}
          <Text style={styles.userName}>{user.name}</Text>

          {/* Role pill */}
          <View style={styles.rolePill}>
            <MaterialIcons name="badge" size={11} color="#2563EB" />
            <Text style={styles.rolePillText}>ORDERBOOKER</Text>
          </View>

          {/* Phone + Active row */}
          <View style={styles.heroMetaRow}>
            {user.phone ? (
              <Pressable
                style={({ pressed }) => [styles.phonePill, pressed && { opacity: 0.85 }]}
                onPress={() => {
                  setPhoneInput(user.phone || '');
                  setIsEditingPhone(true);
                  setTimeout(() => phoneInputRef.current?.focus(), 100);
                }}
              >
                <MaterialIcons name="call" size={12} color="#FFFFFF" />
                <Text style={styles.phonePillText}>{user.phone}</Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.phonePill, pressed && { opacity: 0.85 }]}
                onPress={() => {
                  setPhoneInput('');
                  setIsEditingPhone(true);
                  setTimeout(() => phoneInputRef.current?.focus(), 100);
                }}
              >
                <MaterialIcons name="add-call" size={12} color="#FFFFFF" />
                <Text style={styles.phonePillText}>Add phone</Text>
              </Pressable>
            )}

            <View style={styles.activePill}>
              <View style={styles.activeDot} />
              <Text style={styles.activePillText}>Active</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Phone edit floating bar (only when editing) */}
        {isEditingPhone ? (
          <View style={styles.phoneEditBar}>
            <MaterialIcons name="call" size={18} color="#2563EB" />
            <TextInput
              ref={phoneInputRef}
              value={phoneInput}
              onChangeText={setPhoneInput}
              placeholder="03XXXXXXXXX"
              keyboardType="phone-pad"
              maxLength={15}
              style={styles.phoneEditInput}
              autoFocus
              editable={!isSavingPhone}
              onSubmitEditing={handleSavePhone}
            />
            <Pressable
              onPress={handleSavePhone}
              disabled={isSavingPhone}
              style={[styles.phoneEditBtn, { backgroundColor: '#2563EB' }]}
            >
              {isSavingPhone ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialIcons name="check" size={18} color="#FFFFFF" />
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                setIsEditingPhone(false);
                setPhoneInput('');
              }}
              disabled={isSavingPhone}
              style={[styles.phoneEditBtn, { backgroundColor: Colors.borderLight }]}
            >
              <MaterialIcons name="close" size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* STATS ROW — 3 overlapping cards (Total Shops / Recovery MO / Avg) */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard
            label="Total Shops"
            value={totalShops}
            icon="store"
            accent="#2563EB"
            accentSoft="#DBEAFE"
          />
          <StatCard
            label="Recovery (MO)"
            value={monthRecoveryDisplay}
            icon="trending-up"
            accent="#10B981"
            accentSoft="#D1FAE5"
          />
          <StatCard
            label="Avg/Day"
            value={avgPerDay}
            icon="insights"
            accent="#F59E0B"
            accentSoft="#FEF3C7"
          />
        </View>

        {/* Account compact info card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderIcon}>
              <MaterialIcons name="person-outline" size={14} color="#2563EB" />
            </View>
            <Text style={styles.cardHeaderTitle}>ACCOUNT</Text>
          </View>
          <View style={styles.acctRow}>
            <Text style={styles.acctLabel}>Username</Text>
            <Text style={styles.acctValue}>@{user.username}</Text>
          </View>
          <View style={styles.acctDivider} />
          <View style={styles.acctRow}>
            <Text style={styles.acctLabel}>Status</Text>
            <View style={styles.acctStatusPill}>
              <View style={[styles.acctStatusDot, { backgroundColor: '#10B981' }]} />
              <Text style={[styles.acctStatusText, { color: '#10B981' }]}>
                {user.status === 'active' ? 'Active' : user.status}
              </Text>
            </View>
          </View>
          <View style={styles.acctDivider} />
          <View style={styles.acctRow}>
            <Text style={styles.acctLabel}>Today&apos;s Recovery</Text>
            <Text style={[styles.acctValue, { color: '#10B981' }]}>
              {todayRecovery >= 1000
                ? `Rs. ${(todayRecovery / 1000).toFixed(0)}K`
                : formatPKR(todayRecovery)}
            </Text>
          </View>
          {(user.companyName || selectedCompanyId) ? (
            <>
              <View style={styles.acctDivider} />
              <View style={styles.acctRow}>
                <Text style={styles.acctLabel}>Company</Text>
                <Text style={styles.acctValue} numberOfLines={1}>
                  {selectedCompanyId
                    ? companies.find((c) => c.companyId === selectedCompanyId)?.companyName || user.companyName || 'N/A'
                    : user.companyName || 'N/A'}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Recovery Comparison + Ranking (existing components) */}
        <RecoveryComparison userId={user.id} />
        <PerformanceRanking />

        {/* Recovery Analysis toggle */}
        <Pressable
          style={({ pressed }) => [styles.analysisToggle, pressed && { opacity: 0.9 }]}
          onPress={() => setShowAnalysis((v) => !v)}
        >
          <View style={styles.analysisToggleLeft}>
            <View style={styles.analysisToggleIcon}>
              <MaterialIcons name="analytics" size={20} color="#2563EB" />
            </View>
            <View>
              <Text style={styles.analysisToggleTitle}>Recovery Analysis</Text>
              <Text style={styles.analysisToggleSub}>Credit vs recovery chart</Text>
            </View>
          </View>
          <View style={[styles.toggleIconWrap, showAnalysis && styles.toggleIconWrapActive]}>
            <MaterialIcons
              name={showAnalysis ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={22}
              color={showAnalysis ? '#2563EB' : Colors.textSecondary}
            />
          </View>
        </Pressable>
        {showAnalysis ? <RecoveryAnalysisChart userId={user.id} /> : null}

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* ROUTE TRACKING SECTION                                            */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <SectionLabel icon="navigation" label="Route Tracking" />

        {routeError ? (
          <View style={styles.routeErrorBox}>
            <Text style={styles.routeErrorText}>{routeError}</Text>
          </View>
        ) : null}

        {isTracking ? (
          <View style={styles.routeActiveBox}>
            <View style={styles.routeActiveHeader}>
              <View style={styles.routeActiveDot} />
              <Text style={styles.routeActiveTitle}>Route Active</Text>
            </View>
            <Text style={styles.routeActiveDesc}>
              Started at{' '}
              {startTime
                ? new Date(startTime).toLocaleTimeString('en-PK', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'Asia/Karachi',
                  })
                : '--:--'}
              {'\n'}Your live location is being tracked on the admin panel.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.routeEndBtn,
                pressed && { backgroundColor: '#DC2626' },
              ]}
              onPress={() => {
                Alert.alert(
                  'End Route',
                  'Are you sure you want to end the route? This will stop GPS tracking.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'End Route', style: 'destructive', onPress: endRoute },
                  ]
                );
              }}
              disabled={isStopping}
            >
              {isStopping ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="stop" size={18} color="#FFFFFF" />
                  <Text style={styles.routeEndBtnText}>End Route</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.routeStartCard, pressed && { opacity: 0.9 }]}
            onPress={() => {
              Alert.alert(
                'Start Route',
                'Start tracking your route? Your live location will be visible to the admin panel.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Start Route', onPress: startRoute },
                ]
              );
            }}
            disabled={isStarting}
          >
            <View style={[styles.routeStartIcon, { backgroundColor: '#ECFDF5' }]}>
              {isStarting ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <MaterialIcons name="navigation" size={20} color="#10B981" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeStartTitle}>Start Route</Text>
              <Text style={styles.routeStartSub}>Begin GPS tracking for live route monitoring</Text>
            </View>
          </Pressable>
        )}

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* SETTINGS CARD — grouped rows per mockup                          */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <SectionLabel icon="settings" label="Settings" />
        <View style={styles.card}>
          {/* Row 1: Company Assignments */}
          <SettingsRow
            icon="business"
            iconColor="#2563EB"
            iconBg="#DBEAFE"
            title="Company Assignments"
            subtitle={companies.length > 0 ? `${companies.length} assigned` : 'No company assigned'}
            rightElement={renderCompanyBadges()}
          />

          {/* Row 2: Sync Status (tap to trigger sync upload) */}
          <SettingsRow
            icon="sync"
            iconColor="#10B981"
            iconBg="#D1FAE5"
            title="Sync Status"
            subtitle={lastSyncedAt ? `Last synced ${lastSyncedAt}` : 'Not synced yet'}
            onPress={handleSyncUpload}
            rightElement={
              <View style={styles.syncStatusDotWrap}>
                <View style={styles.syncStatusDot} />
              </View>
            }
          />

          {/* Row 3: Notifications toggle */}
          <SettingsRow
            icon="notifications"
            iconColor="#F59E0B"
            iconBg="#FEF3C7"
            title="Notifications"
            subtitle={notificationsEnabled ? 'Enabled' : 'Muted'}
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                thumbColor="#FFFFFF"
              />
            }
          />

          {/* Row 4: Help & Support */}
          <SettingsRow
            icon="help-outline"
            iconColor="#2563EB"
            iconBg="#DBEAFE"
            title="Help & Support"
            subtitle="FAQs, contact, & guides"
            onPress={() => Alert.alert('Help & Support', 'Contact: support@finexa.app')}
            showChevron
          />

          {/* Row 7: About App */}
          <SettingsRow
            icon="info-outline"
            iconColor="#2563EB"
            iconBg="#DBEAFE"
            title="About App"
            subtitle="Version & legal info"
            onPress={() =>
              Alert.alert(
                'About Finexa',
                'Finexa OB App\nVersion 2.4.1\n© 2024 Al-Falah Traders\n\nCredit & Recovery System for order bookers.'
              )
            }
            rightElement={
              <View style={styles.versionPill}>
                <Text style={styles.versionPillText}>{APP_VERSION}</Text>
              </View>
            }
            showChevron
          />

          {/* Additional row: Change PIN (preserve existing functionality) */}
          <SettingsRow
            icon="lock-outline"
            iconColor="#2563EB"
            iconBg="#DBEAFE"
            title="Change PIN"
            subtitle="Update your 4-digit security PIN"
            onPress={handleChangePin}
            showChevron
          />

          {/* Additional row: Clear App Data (danger) */}
          <SettingsRow
            icon="delete-sweep"
            iconColor={Colors.danger}
            iconBg="#FEE2E2"
            title="Clear App Data"
            subtitle="Remove all local data & saved URL"
            onPress={handleClearAppData}
            danger
            isLast
            showChevron
          />
        </View>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* LOGOUT BUTTON — red outline                                       */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.85 }]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <>
              <MaterialIcons name="logout" size={20} color="#EF4444" />
              <Text style={styles.logoutBtnText}>Logout</Text>
            </>
          )}
        </Pressable>

        {/* Footer */}
        <Text style={styles.footerText}>
          Finexa OB App • {APP_VERSION} • © 2024 Al-Falah Traders
        </Text>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AuroraColors.bgDeep },
  scroll: { paddingBottom: 100 },

  // ── Hero ──
  hero: {
    alignItems: 'center',
    paddingTop: Spacing.xl + 8,
    paddingBottom: Spacing.xl + 24,
    paddingHorizontal: Spacing.md,
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroBubble1: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(96,165,250,0.18)',
    top: -90,
    right: -70,
  },
  heroBubble2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(96,165,250,0.12)',
    bottom: -50,
    left: -40,
  },
  heroBubble3: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: 40,
    left: 30,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    ...Shadow.lg,
  },
  avatarText: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    color: '#2563EB',
  },
  avatarRingDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22C55E',
    borderWidth: 3,
    borderColor: '#1E40AF',
  },
  userName: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  rolePillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#2563EB',
    letterSpacing: 1,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  phonePillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#22C55E',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  activePillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },

  // ── Phone edit bar ──
  phoneEditBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    marginHorizontal: Spacing.md,
    marginTop: -Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...Shadow.md,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  phoneEditInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    fontSize: FontSize.base,
    color: Colors.text,
    backgroundColor: '#F8FAFC',
  },
  phoneEditBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Stats row (overlapping hero) ──
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: -Spacing.xl - 4,
    marginBottom: Spacing.md,
  },

  // ── Generic card ──
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cardHeaderIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // ── Account rows ──
  acctRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  acctLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
  },
  acctValue: {
    fontSize: FontSize.base,
    color: Colors.text,
    fontWeight: FontWeight.semibold,
    maxWidth: '60%',
    textAlign: 'right',
  },
  acctDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderLight,
    marginVertical: 2,
  },
  acctStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  acctStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  acctStatusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },

  // ── Analysis toggle ──
  analysisToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  analysisToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  analysisToggleIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analysisToggleTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text },
  analysisToggleSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  toggleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleIconWrapActive: { backgroundColor: '#DBEAFE' },

  // ── Route error / active / start ──
  routeErrorBox: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  routeErrorText: { fontSize: FontSize.xs, color: '#DC2626' },

  routeActiveBox: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  routeActiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  routeActiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  routeActiveTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#065F46',
  },
  routeActiveDesc: {
    fontSize: FontSize.xs,
    color: '#047857',
    marginBottom: 12,
  },
  routeEndBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 10,
  },
  routeEndBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },

  routeStartCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  routeStartIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeStartTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  routeStartSub: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },

  // ── Company badges ──
  companyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
    maxWidth: 160,
    justifyContent: 'flex-end',
  },
  badgePill: {
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgePillActive: {
    backgroundColor: '#2563EB',
  },
  badgePillSoft: {
    backgroundColor: '#F1F5F9',
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },
  badgePillTextActive: { color: '#FFFFFF' },
  badgePillTextMuted: { color: Colors.textSecondary },

  // ── Sync status dot ──
  syncStatusDotWrap: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },

  // ── Language pill ──
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.full,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  langPillSide: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  langPillSideActive: {
    backgroundColor: '#2563EB',
  },
  langPillDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 2,
  },
  langPillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  langPillTextActive: {
    color: '#FFFFFF',
  },

  // ── Version pill ──
  versionPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  versionPillText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },

  // ── Logout ──
  logoutBtn: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#EF4444',
    ...Shadow.sm,
  },
  logoutBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#EF4444',
  },

  // ── Footer ──
  footerText: {
    textAlign: 'center',
    marginTop: Spacing.md,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.3,
  },
});
