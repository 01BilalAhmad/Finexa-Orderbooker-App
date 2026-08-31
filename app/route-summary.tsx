// app/route-summary.tsx
// Route End Summary — shown after the orderbooker ends a route.
//
// Rules (confirmed with user — Option D Hybrid):
//   1. Shows ONLY shops where recovery was taken (skips shops with no recovery)
//   2. Each shop shows: name + total recovery + status badges (Pending / Approved)
//   3. Pending recovery → Editable (Edit button visible)
//   4. Approved recovery → 🔒 Locked (no Edit, no Delete)
//   5. Delete button → NEVER shown (any status)
//   6. Two CTAs at the bottom:
//        - "Resume Route" → re-opens the ended session (same-day only)
//        - "Done" → navigates to home (route start screen will appear next launch)
//
// Flow:
//   Route Active → user taps "End Route" → double confirm → endRoute()
//     → sync upload → navigate here (route-summary)
//     → user taps "Resume Route" → resumeRoute() → navigate to home (route active again)
//     → OR user taps "Done" → navigate to home (route start screen next launch)

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useRouteTracking } from '@/contexts/RouteTrackingContext';
import { RouteTrackingService } from '@/services/routeTracking';
import { ApiService } from '@/services/api';
import { StorageService } from '@/services/storage';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { formatPKR, getTodayLabel } from '@/utils/format';
import { generateRouteSummaryPdf } from '@/utils/generateRouteSummaryPdf';

// ── Types ──────────────────────────────────────────────────────────
interface RecoveryEntry {
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
}

interface RecoveryShop {
  shopId: string;
  shopName: string;
  shopArea: string | null;
  shopBalance: number;
  totalRecovery: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  entries: RecoveryEntry[];
}

interface SessionRecoveriesResponse {
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
  shops: RecoveryShop[];
}

// ── Helpers ────────────────────────────────────────────────────────
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

// ── Edit Recovery Modal (inline) ───────────────────────────────────
function EditAmountModal({
  visible, entry, onClose, onSaved,
}: {
  visible: boolean;
  entry: RecoveryEntry | null;
  onClose: () => void;
  onSaved: (newAmount: number) => void;
}) {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && entry) {
      setAmount(entry.amount.toString());
      setSaving(false);
    }
  }, [visible, entry]);

  if (!entry) return null;

  const handleSave = async () => {
    const newAmount = parseInt(amount, 10);
    if (!newAmount || newAmount < 100) {
      Alert.alert('Invalid Amount', 'Minimum recovery amount is Rs. 100');
      return;
    }
    if (newAmount > 500000) {
      Alert.alert('Invalid Amount', 'Maximum recovery amount is Rs. 500,000');
      return;
    }
    if (newAmount === entry.amount) {
      Alert.alert('No Change', 'New amount is same as current amount.');
      return;
    }

    setSaving(true);
    try {
      // Use the existing edit-pending API — needs updatedBy (creator).
      await ApiService.editPendingRecovery(entry.id, {
        amount: newAmount,
        updatedBy: entry.createdBy,
      });
      onSaved(newAmount);
      onClose();
    } catch (e: any) {
      Alert.alert('Edit Failed', e.message || 'Recovery edit nahi ho saki. Dobarra try karein.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.editOverlay}
      >
        <View style={styles.editCard}>
          <View style={styles.editHeader}>
            <Text style={styles.editTitle}>Edit Recovery</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.editLabel}>Current: {formatPKR(entry.amount)}</Text>
          <Text style={styles.editHint}>Status: {entry.status}</Text>

          <TextInput
            style={styles.editInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="New amount"
            autoFocus
          />

          <View style={styles.editBtnRow}>
            <Pressable style={styles.editCancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.editCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.editSaveBtn, saving && styles.editSaveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.editSaveText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Shop Card ──────────────────────────────────────────────────────
function ShopCard({
  shop, onEditEntry,
}: {
  shop: RecoveryShop;
  onEditEntry: (entry: RecoveryEntry) => void;
}) {
  return (
    <View style={styles.shopCard}>
      {/* Shop header */}
      <View style={styles.shopHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.shopName} numberOfLines={1}>{shop.shopName}</Text>
          {shop.shopArea ? (
            <Text style={styles.shopArea} numberOfLines={1}>{shop.shopArea}</Text>
          ) : null}
        </View>
        <View style={styles.shopTotalWrap}>
          <Text style={styles.shopTotalAmount}>{formatPKR(shop.totalRecovery)}</Text>
          <Text style={styles.shopTotalLabel}>Recovery</Text>
          <Text style={styles.shopRemainingAmount}>{formatPKR(shop.shopBalance)}</Text>
          <Text style={styles.shopTotalLabel}>Remaining</Text>
        </View>
      </View>

      {/* Status badges row */}
      <View style={styles.badgesRow}>
        {shop.pendingCount > 0 ? (
          <View style={[styles.badge, styles.badgePending]}>
            <MaterialIcons name="schedule" size={11} color="#B45309" />
            <Text style={styles.badgeTextPending}>{shop.pendingCount} Pending</Text>
          </View>
        ) : null}
        {shop.approvedCount > 0 ? (
          <View style={[styles.badge, styles.badgeApproved]}>
            <MaterialIcons name="check-circle" size={11} color="#047857" />
            <Text style={styles.badgeTextApproved}>{shop.approvedCount} Approved</Text>
          </View>
        ) : null}
        {shop.rejectedCount > 0 ? (
          <View style={[styles.badge, styles.badgeRejected]}>
            <MaterialIcons name="cancel" size={11} color="#B91C1C" />
            <Text style={styles.badgeTextRejected}>{shop.rejectedCount} Rejected</Text>
          </View>
        ) : null}
      </View>

      {/* Entries */}
      <View style={styles.entriesList}>
        {shop.entries.map((entry) => {
          const approved = entry.status === 'approved';
          const rejected = entry.status === 'rejected';
          const pending = entry.status === 'pending';
          return (
            <View key={entry.id} style={styles.entryRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.entryTopRow}>
                  <Text style={styles.entryAmount}>{formatPKR(entry.amount)}</Text>
                  {pending ? (
                    <View style={[styles.entryStatusPill, styles.pillPending]}>
                      <Text style={styles.pillTextPending}>Pending</Text>
                    </View>
                  ) : approved ? (
                    <View style={[styles.entryStatusPill, styles.pillApproved]}>
                      <MaterialIcons name="lock" size={10} color="#047857" />
                      <Text style={styles.pillTextApproved}>Approved · Locked</Text>
                    </View>
                  ) : (
                    <View style={[styles.entryStatusPill, styles.pillRejected]}>
                      <Text style={styles.pillTextRejected}>Rejected</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.entryTime}>{formatTime(entry.createdAt)}</Text>
                {entry.gpsAddress ? (
                  <Text style={styles.entryGps} numberOfLines={1}>📍 {entry.gpsAddress}</Text>
                ) : null}
                {rejected && entry.rejectReason ? (
                  <Text style={styles.entryRejectReason} numberOfLines={2}>
                    Reason: {entry.rejectReason}
                  </Text>
                ) : null}
              </View>

              {/* Action button */}
              {pending ? (
                <Pressable
                  style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
                  onPress={() => onEditEntry(entry)}
                >
                  <MaterialIcons name="edit" size={14} color={Colors.primary} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              ) : approved ? (
                <View style={styles.lockedBtn}>
                  <MaterialIcons name="lock" size={12} color={Colors.textMuted} />
                  <Text style={styles.lockedBtnText}>Locked</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────
export default function RouteSummaryScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { resumeRoute, isResuming, lastEndedSessionId } = useRouteTracking();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<SessionRecoveriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<RecoveryEntry | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // ── Download PDF ──────────────────────────────────────────────
  const handleDownloadPdf = useCallback(async () => {
    if (!data || !user) return;
    setGeneratingPdf(true);
    try {
      await generateRouteSummaryPdf(data, user.name);
    } catch (e: any) {
      Alert.alert('PDF Error', e?.message || 'Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
    }
  }, [data, user]);

  // Resolve the session ID — either from context (lastEndedSessionId) or from storage
  useEffect(() => {
    (async () => {
      let sid = lastEndedSessionId;
      if (!sid) {
        sid = await StorageService.getResumableSessionId();
      }
      setSessionId(sid);
    })();
  }, [lastEndedSessionId]);

  const fetchRecoveries = useCallback(async () => {
    if (!sessionId) {
      setError('Koi ended route nahi mila. Naya route start karein.');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const resp = await RouteTrackingService.getSessionRecoveries(
        sessionId,
        user?.id
      );
      setData(resp);
    } catch (e: any) {
      setError(e.message || 'Recovery data load nahi ho saka.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionId, user?.id]);

  useEffect(() => {
    fetchRecoveries();
  }, [fetchRecoveries]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRecoveries();
  }, [fetchRecoveries]);

  const handleEditSaved = useCallback(() => {
    // Refresh data after a successful edit
    fetchRecoveries();
  }, [fetchRecoveries]);

  const handleResume = useCallback(async () => {
    Alert.alert(
      'Resume Route?',
      'Aap ne galti se route end kiya tha kya? Resume karne se route wapas active ho jayega aur aap shops visit kar sakte hain. Recovery data bhi preserve rahega.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resume',
          onPress: async () => {
            try {
              await resumeRoute();
              // Navigate to home — route is now active
              router.replace('/(tabs)');
            } catch (e: any) {
              Alert.alert('Resume Failed', e.message || 'Route resume nahi ho saka.');
            }
          },
        },
      ]
    );
  }, [resumeRoute]);

  const handleDone = useCallback(() => {
    Alert.alert(
      'Done?',
      'Aap route summary band kar rahe hain. Agar aap ne galti se route end kiya tha to ab "Resume Route" button nahi milega — naya route kal start hoga.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Done',
          style: 'destructive',
          onPress: async () => {
            // Clear the resumable session so it doesn't show stale data next time
            try {
              await StorageService.clearLastEndedSession();
            } catch {}
            // Go back to root — index.tsx will route to /route-start (since session is null).
            // This matches the post-route-end flow: user ends route → app shows route-start
            // next launch asking them to start a new route.
            router.replace('/');
          },
        },
      ]
    );
  }, []);

  // ── Render states ──────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Recovery summary load ho raha hai…</Text>
      </View>
    );
  }

  const totalRecovery = data?.totalRecovery ?? 0;
  const totalPending = data?.totalPending ?? 0;
  const totalApproved = data?.totalApproved ?? 0;
  const shops = data?.shops ?? [];

  return (
    <SafeAreaView style={styles.root}>
      {/* Header (gradient) */}
      <LinearGradient
        colors={['#4F46E5', '#4338CA', '#4338CA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + Spacing.md }]}
      >
        <View style={styles.headerTopRow}>
          <View style={styles.headerIconCircle}>
            <MaterialIcons name="flag" size={26} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Route Summary</Text>
            <Text style={styles.headerDate}>{getTodayLabel()}</Text>
          </View>
        </View>

        {/* Total recovery stat */}
        <View style={styles.totalStatCard}>
          <View style={styles.totalStatLeft}>
            <Text style={styles.totalStatLabel}>Total Recovery Today</Text>
            <Text style={styles.totalStatValue}>{formatPKR(totalRecovery)}</Text>
          </View>
          <View style={styles.totalStatRight}>
            <View style={styles.totalStatPill}>
              <MaterialIcons name="store" size={12} color="#4338CA" />
              <Text style={styles.totalStatPillText}>{shops.length} Shops</Text>
            </View>
            {totalApproved > 0 ? (
              <View style={[styles.totalStatPill, styles.pillApprovedBg]}>
                <Text style={styles.pillApprovedTextSmall}>
                  ✓ {formatPKR(totalApproved)} Approved
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {totalPending > 0 ? (
          <View style={styles.pendingBanner}>
            <MaterialIcons name="info" size={14} color="#FEF3C7" />
            <Text style={styles.pendingBannerText}>
              {formatPKR(totalPending)} admin approval ka wait kar raha hai
            </Text>
          </View>
        ) : null}
      </LinearGradient>

      {/* Body — list of recovery shops */}
      {error ? (
        <View style={styles.errorWrap}>
          <MaterialIcons name="error-outline" size={32} color={Colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchRecoveries}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : shops.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialIcons name="inbox" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Koi Recovery Nahi</Text>
          <Text style={styles.emptySubtitle}>
            Aaj ke route mein kisi shop se recovery nahi li gayi.
          </Text>
        </View>
      ) : (
        <FlatList
          data={shops}
          keyExtractor={(item) => item.shopId}
          renderItem={({ item }) => (
            <ShopCard shop={item} onEditEntry={(entry) => setEditingEntry(entry)} />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 100 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      {/* Bottom action bar — Download PDF + Resume + Done */}
      <View
        style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.sm }]}
      >
        <Pressable
          style={({ pressed }) => [styles.pdfBtn, pressed && styles.pdfBtnPressed, generatingPdf && styles.pdfBtnDisabled]}
          onPress={handleDownloadPdf}
          disabled={generatingPdf || !data}
        >
          {generatingPdf ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="picture-as-pdf" size={18} color="#FFFFFF" />
              <Text style={styles.pdfBtnText}>PDF</Text>
            </>
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.resumeBtn, pressed && styles.resumeBtnPressed]}
          onPress={handleResume}
          disabled={isResuming || !sessionId}
        >
          {isResuming ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="play-arrow" size={18} color="#FFFFFF" />
              <Text style={styles.resumeBtnText}>Resume</Text>
            </>
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.doneBtn, pressed && styles.doneBtnPressed]}
          onPress={handleDone}
          disabled={isResuming}
        >
          <MaterialIcons name="check" size={18} color={Colors.primary} />
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>
      </View>

      {/* Edit Modal */}
      <EditAmountModal
        visible={!!editingEntry}
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSaved={handleEditSaved}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.md },
  loadingText: { fontSize: FontSize.base, color: Colors.textSecondary },

  // Header
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl, ...Shadow.lg },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  headerIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: '#FFFFFF' },
  headerDate: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  totalStatCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  totalStatLeft: { flex: 1 },
  totalStatLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)', fontWeight: FontWeight.medium },
  totalStatValue: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: '#FFFFFF', marginTop: 2 },
  totalStatRight: { alignItems: 'flex-end', gap: Spacing.xs },
  totalStatPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFFFFF', borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  totalStatPillText: { fontSize: FontSize.xs, color: '#4338CA', fontWeight: FontWeight.bold },
  pillApprovedBg: { backgroundColor: '#D1FAE5' },
  pillApprovedTextSmall: { fontSize: FontSize.xs, color: '#047857', fontWeight: FontWeight.bold },

  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(245,158,11,0.25)', borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    marginTop: Spacing.md, borderWidth: 1, borderColor: 'rgba(245,158,11,0.5)',
  },
  pendingBannerText: { fontSize: FontSize.xs, color: '#FEF3C7', fontWeight: FontWeight.medium, flex: 1 },

  // List
  list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },

  // Shop Card
  shopCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  shopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  shopName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  shopArea: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  shopTotalWrap: { alignItems: 'flex-end' },
  shopTotalAmount: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  shopTotalLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, marginBottom: 2 },
  shopRemainingAmount: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.danger, marginTop: 4 },

  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  badgePending: { backgroundColor: Colors.warningLight },
  badgeApproved: { backgroundColor: Colors.successLight },
  badgeRejected: { backgroundColor: Colors.dangerLight },
  badgeTextPending: { fontSize: 10, color: '#B45309', fontWeight: FontWeight.bold },
  badgeTextApproved: { fontSize: 10, color: '#047857', fontWeight: FontWeight.bold },
  badgeTextRejected: { fontSize: 10, color: '#B91C1C', fontWeight: FontWeight.bold },

  entriesList: { borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: Spacing.xs },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  entryTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  entryAmount: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text },
  entryStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: Radius.full },
  pillPending: { backgroundColor: Colors.warningLight },
  pillApproved: { backgroundColor: Colors.successLight },
  pillRejected: { backgroundColor: Colors.dangerLight },
  pillTextPending: { fontSize: 10, color: '#B45309', fontWeight: FontWeight.bold },
  pillTextApproved: { fontSize: 10, color: '#047857', fontWeight: FontWeight.bold },
  pillTextRejected: { fontSize: 10, color: '#B91C1C', fontWeight: FontWeight.bold },
  entryTime: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  entryGps: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  entryRejectReason: { fontSize: FontSize.xs, color: Colors.danger, marginTop: 2, fontStyle: 'italic' },

  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary },
  editBtnPressed: { opacity: 0.7 },
  editBtnText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.bold },

  lockedBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.borderLight, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.md },
  lockedBtnText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },

  // Bottom bar
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1, borderTopColor: Colors.border,
    ...Shadow.lg,
  },
  pdfBtn: { flex: 0.7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: '#DC2626', paddingVertical: Spacing.md, borderRadius: Radius.lg, ...Shadow.md },
  pdfBtnPressed: { opacity: 0.85 },
  pdfBtnDisabled: { opacity: 0.5 },
  pdfBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#FFFFFF' },
  resumeBtn: { flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: Radius.lg, ...Shadow.md },
  resumeBtnPressed: { opacity: 0.85 },
  resumeBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#FFFFFF' },
  doneBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.primaryLight, paddingVertical: Spacing.md, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.primary },
  doneBtnPressed: { opacity: 0.7 },
  doneBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary },

  // Edit Modal
  editOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: Spacing.xl },
  editCard: { backgroundColor: '#FFFFFF', borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', ...Shadow.xl },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  editTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  editLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 4 },
  editHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.md, fontStyle: 'italic' },
  editInput: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.lg, color: Colors.text, marginBottom: Spacing.lg },
  editBtnRow: { flexDirection: 'row', gap: Spacing.sm },
  editCancelBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.borderLight, alignItems: 'center' },
  editCancelText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  editSaveBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  editSaveBtnDisabled: { opacity: 0.6 },
  editSaveText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#FFFFFF' },

  // Empty / error
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.xs },

  errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  errorText: { fontSize: FontSize.base, color: Colors.danger, textAlign: 'center' },
  retryBtn: { marginTop: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.primary },
  retryBtnText: { color: '#FFFFFF', fontWeight: FontWeight.bold, fontSize: FontSize.base },
});
