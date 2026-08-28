// Powered by Finexa
import React, { useEffect, useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
  Dimensions,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart } from 'react-native-chart-kit';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { AuroraColors } from '@/constants/auroraTheme';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { Shop, Transaction, ApiService } from '@/services/api';
import { getShopDisplayBalance } from '@/components/ui/ShopCard';
import { formatPKR, formatDateTime } from '@/utils/format';
import { CreditBar } from './CreditBar';
import { Badge } from './Badge';
import { StorageService, ShopNote } from '@/services/storage';

const screenWidth = Dimensions.get('window').width;

interface ShopDetailModalProps {
  visible: boolean;
  shop: Shop | null;
  companyId?: string;
  onClose: () => void;
  onCollect: () => void;
  hasRecoveryToday?: boolean; // Whether recovery was submitted for this shop today
  onResendReceipt?: () => void; // Callback to resend receipt
  onEditPendingRecovery?: (txn: Transaction) => void; // Callback to edit a pending recovery
}

export const ShopDetailModal = memo(function ShopDetailModal({
  visible,
  shop,
  companyId,
  onClose,
  onCollect,
  hasRecoveryToday,
  onResendReceipt,
  onEditPendingRecovery,
}: ShopDetailModalProps) {
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<{ labels: string[]; credits: number[]; recoveries: number[] }>({
    labels: [],
    credits: [],
    recoveries: [],
  });
  const [chartLoading, setChartLoading] = useState(false);
  const [shopNote, setShopNote] = useState<ShopNote | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  // Speech-to-Text hook for hands-free note-taking
  const speechToText = useSpeechToText();

  // When a new transcript chunk arrives, append it to the existing note input
  useEffect(() => {
    if (speechToText.transcript) {
      setNoteInput((prev) => {
        const prefix = prev.trim() ? prev + ' ' : '';
        return prefix + speechToText.transcript;
      });
      // Clear the hook's transcript buffer so we don't re-append it
      speechToText.clearTranscript();
    }
  }, [speechToText.transcript]);

  // Toggle listening state — if not listening, start; otherwise stop
  const toggleSpeechToText = async () => {
    if (speechToText.isListening) {
      speechToText.stopListening();
    } else {
      await speechToText.startListening('en-US');
    }
  };

  // Phone edit state
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [localPhone, setLocalPhone] = useState<string | null>(null);
  const [ownerNameInput, setOwnerNameInput] = useState('');
  const [localOwnerName, setLocalOwnerName] = useState<string | null>(null);

  useEffect(() => {
    if (visible && shop) {
      loadRecent();
      loadChartData();
      loadShopNote();
      setLocalPhone(null);
      setEditingPhone(false);
      setPhoneInput('');
      setOwnerNameInput('');
      setLocalOwnerName(null);
    }
  }, [visible, shop]);

  async function loadRecent() {
    if (!shop) return;
    setLoading(true);
    try {
      const res = await ApiService.getTransactions({ shopId: shop.id, limit: 8 });
      setRecentTxns(res.transactions);
    } catch {
      setRecentTxns([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadChartData() {
    if (!shop) return;
    setChartLoading(true);
    try {
      const now = new Date();
      const labels: string[] = [];
      const credits: number[] = [];
      const recoveries: number[] = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString('en-PK', { month: 'short' });
        const startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
        const endD = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        labels.push(label);
        try {
          const res = await ApiService.getTransactions({ shopId: shop.id, date: startDate, limit: 500 });
          const endDateStr = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
          const monthTxns = res.transactions.filter((t) => {
            const tDate = t.createdAt.split('T')[0];
            return tDate >= startDate && tDate <= endDateStr;
          });
          const c = monthTxns.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
          const r = monthTxns.filter((t) => t.type === 'recovery').reduce((s, t) => s + t.amount, 0);
          credits.push(c);
          recoveries.push(r);
        } catch {
          credits.push(0);
          recoveries.push(0);
        }
      }
      setChartData({ labels, credits, recoveries });
    } catch {
      setChartData({ labels: [], credits: [], recoveries: [] });
    } finally {
      setChartLoading(false);
    }
  }

  async function loadShopNote() {
    if (!shop) return;
    try {
      const note = await StorageService.getShopNote(shop.id);
      setShopNote(note);
      setNoteInput(note ? note.note : '');
    } catch {
      setShopNote(null);
      setNoteInput('');
    }
  }

  async function handleSaveNote() {
    if (!shop) return;
    setNoteSaving(true);
    try {
      await StorageService.saveShopNote(shop.id, noteInput.trim());
      await loadShopNote();
    } catch {
      Alert.alert('Error', 'Could not save note.');
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleDeleteNote() {
    if (!shop) return;
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await StorageService.deleteShopNote(shop.id);
            setShopNote(null);
            setNoteInput('');
          } catch { /* not critical */ }
        },
      },
    ]);
  }

  // Current phone: local override or shop prop
  const currentPhone = localPhone ?? shop?.phone ?? '';
  const currentOwnerName = localOwnerName ?? shop?.ownerName ?? '';

  function handleSmsPress() {
    if (!shop) return;
    if (!currentPhone) {
      Alert.alert(
        'No Phone Number',
        "This shop doesn't have a phone number saved.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Phone Number',
            onPress: () => {
              setPhoneInput('');
              setEditingPhone(true);
            },
          },
        ]
      );
      return;
    }
    const phone = currentPhone.trim().replace(/[^0-9+]/g, '');
    Linking.openURL(`sms:${phone}`);
  }

  function handleWhatsappPress() {
    if (!shop) return;
    if (!currentPhone) {
      Alert.alert(
        'No Phone Number',
        "This shop doesn't have a phone number saved.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Phone Number',
            onPress: () => {
              setPhoneInput('');
              setEditingPhone(true);
            },
          },
        ]
      );
      return;
    }
    let formattedPhone = currentPhone.trim().replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = formattedPhone.substring(1);
    }
    if (!formattedPhone.startsWith('92')) {
      formattedPhone = '92' + formattedPhone;
    }
    Linking.openURL(`https://wa.me/${formattedPhone}`);
  }

  function handleCallPress() {
    if (!shop) return;
    if (!currentPhone) {
      Alert.alert(
        'No Phone Number',
        "This shop doesn't have a phone number saved.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Phone Number',
            onPress: () => {
              setPhoneInput('');
              setEditingPhone(true);
            },
          },
        ]
      );
      return;
    }
    Linking.openURL(`tel:${currentPhone}`);
  }

  function handleNavigatePress() {
    if (!shop) return;
    if (shop.lat != null && shop.lng != null) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}`);
    } else if (shop.address) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`);
    } else if (shop.area) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.area)}`);
    } else {
      Alert.alert('No Location', 'This shop has no address or coordinates saved.');
    }
  }

  function handleSharePress() {
    if (!shop) return;
    const shareText = `Shop: ${shop.name}\nOwner: ${currentOwnerName || '-'}\nPhone: ${currentPhone || '-'}\nAddress: ${shop.address || shop.area || '-'}\nOutstanding: ${formatPKR(getShopDisplayBalance(shop, companyId).balance)}`;
    Linking.openURL(`mailto:?subject=Shop Info: ${shop.name}&body=${encodeURIComponent(shareText)}`).catch(() => {
      Alert.alert('Shop Info', shareText);
    });
  }

  async function handleSavePhone() {
    if (!shop) return;
    const trimmed = phoneInput.trim();
    if (!trimmed) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number.');
      return;
    }
    setPhoneSaving(true);
    try {
      const trimmedOwner = ownerNameInput.trim();
      await ApiService.updateShopPhone(shop.id, trimmed, trimmedOwner || undefined);
      setLocalPhone(trimmed);
      if (trimmedOwner) setLocalOwnerName(trimmedOwner);
      setEditingPhone(false);
      setPhoneInput('');
      setOwnerNameInput('');
      Alert.alert('Updated', 'Phone number and owner name have been updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update. Please try again.');
    } finally {
      setPhoneSaving(false);
    }
  }

  function handleEditPhone() {
    setPhoneInput(currentPhone);
    setOwnerNameInput(currentOwnerName);
    setEditingPhone(true);
  }

  if (!shop) return null;

  const { balance: displayBalance, creditLimit: displayCreditLimit } = getShopDisplayBalance(shop, companyId);
  const utilisationPct = displayCreditLimit > 0 ? Math.min((displayBalance / displayCreditLimit) * 100, 100) : 0;
  const isOverLimit = displayCreditLimit > 0 && displayBalance > displayCreditLimit;
  const hasChartData = chartData.credits.some((v) => v > 0) || chartData.recoveries.some((v) => v > 0);

  const totalRecovery = chartData.recoveries.reduce((s, v) => s + v, 0);
  const totalCredit = chartData.credits.reduce((s, v) => s + v, 0);

  // Last visit: most recent recovery txn, or "Today"/"N/A"
  const lastRecoveryTxn = recentTxns.find((t) => t.type === 'recovery');
  const lastVisitLabel = lastRecoveryTxn ? formatDateTime(lastRecoveryTxn.createdAt) : (hasRecoveryToday ? 'Today' : 'N/A');

  // Per-company breakdown
  const companyBalances = shop.companyBalances && shop.companyBalances.length > 0 ? shop.companyBalances : null;

  // Color for the total balance based on tier
  const totalBalanceColor = displayBalance > 50000 ? '#EF4444' : displayBalance >= 10000 ? '#F59E0B' : '#10B981';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* ============ HERO HEADER (blue gradient, centered avatar) ============ */}
          <LinearGradient
            colors={['#1E40AF', '#2563EB', '#3B82F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroHeader}
          >
            {/* Decorative bubbles */}
            <View style={styles.heroBubble1} />
            <View style={styles.heroBubble2} />
            <View style={styles.heroBubble3} />

            {/* Close button — top-right white circle */}
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <MaterialIcons name="close" size={20} color="#2563EB" />
            </Pressable>

            {/* Centered avatar + name + owner */}
            <View style={styles.heroIdentity}>
              <View style={styles.heroAvatar}>
                <Text style={styles.heroAvatarText}>{shop.name.charAt(0).toUpperCase()}</Text>
              </View>
              {isOverLimit ? (
                <View style={styles.heroOverLimitPill}>
                  <MaterialIcons name="warning" size={10} color="#FFFFFF" />
                  <Text style={styles.heroOverLimitText}>OVER LIMIT</Text>
                </View>
              ) : null}
              <Text style={styles.heroShopName} numberOfLines={1}>{shop.name}</Text>
              <Text style={styles.heroOwner} numberOfLines={1}>
                {currentOwnerName || shop.ownerName || 'Owner not set'}
              </Text>
            </View>

            {/* Quick action pills row: Call / SMS / WhatsApp / Share */}
            <View style={styles.actionPillRow}>
              <Pressable
                style={({ pressed }) => [styles.actionPill, pressed && styles.actionPillPressed]}
                onPress={handleCallPress}
              >
                <MaterialIcons name="call" size={15} color="#FFFFFF" />
                <Text style={styles.actionPillText}>Call</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionPill, pressed && styles.actionPillPressed]}
                onPress={handleSmsPress}
              >
                <MaterialIcons name="sms" size={15} color="#FFFFFF" />
                <Text style={styles.actionPillText}>SMS</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionPill, pressed && styles.actionPillPressed]}
                onPress={handleWhatsappPress}
              >
                <MaterialIcons name="chat" size={15} color="#FFFFFF" />
                <Text style={styles.actionPillText}>WhatsApp</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionPill, pressed && styles.actionPillPressed]}
                onPress={handleSharePress}
              >
                <MaterialIcons name="share" size={15} color="#FFFFFF" />
                <Text style={styles.actionPillText}>Share</Text>
              </Pressable>
            </View>

            {/* Address row */}
            {(shop.address || shop.area) ? (
              <View style={styles.heroAddressRow}>
                <MaterialIcons name="location-on" size={13} color="rgba(255,255,255,0.9)" />
                <Text style={styles.heroAddressText} numberOfLines={1}>{shop.address || shop.area}</Text>
              </View>
            ) : null}
          </LinearGradient>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* ============ PHONE CHIP / EDIT ROW ============ */}
            {currentPhone ? (
              <View style={styles.phoneRow}>
                <Pressable
                  style={({ pressed }) => [styles.phoneChip, pressed && { opacity: 0.8 }]}
                  onPress={() => Linking.openURL(`tel:${currentPhone}`)}
                >
                  <MaterialIcons name="call" size={13} color="#2563EB" />
                  <Text style={styles.phoneChipText}>{currentPhone}</Text>
                </Pressable>
                <Pressable onPress={handleEditPhone} hitSlop={8} style={styles.phoneEditBtn}>
                  <MaterialIcons name="edit" size={14} color="#2563EB" />
                  <Text style={styles.phoneEditText}>Edit</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.noPhoneChip, pressed && { opacity: 0.8 }]}
                onPress={handleEditPhone}
              >
                <MaterialIcons name="phone-disabled" size={13} color="#D97706" />
                <Text style={styles.noPhoneText}>No phone number — tap to add</Text>
                <MaterialIcons name="add-circle-outline" size={13} color="#D97706" />
              </Pressable>
            )}

            {/* ============ BALANCE BREAKDOWN CARD ============ */}
            <View style={styles.balanceCard}>
              <View style={styles.balanceCardTop}>
                <View>
                  <Text style={styles.balanceCardLabel}>OUTSTANDING BALANCE</Text>
                  <Text style={[styles.balanceCardTotal, { color: totalBalanceColor }]}>
                    {formatPKR(displayBalance)}
                  </Text>
                </View>
                <View style={styles.balanceCardLimitPill}>
                  <Text style={styles.balanceCardLimitLabel}>Credit Limit</Text>
                  <Text style={styles.balanceCardLimitValue}>{formatPKR(displayCreditLimit)}</Text>
                </View>
              </View>

              {/* Per-company breakdown rows */}
              {companyBalances ? (
                <View style={styles.companyBreakdownList}>
                  {companyBalances.map((cb, idx) => (
                    <View key={cb.companyId || idx} style={styles.companyBreakdownRow}>
                      <View style={[styles.companyDot, { backgroundColor: idx % 2 === 0 ? '#2563EB' : '#3B82F6' }]} />
                      <Text style={styles.companyName} numberOfLines={1}>{cb.companyName || `Company ${idx + 1}`}</Text>
                      <Text style={styles.companyBalance}>{formatPKR(cb.balance || 0)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Utilization progress bar */}
              {displayCreditLimit > 0 ? (
                <View style={styles.utilisationSection}>
                  <View style={styles.utilisationHeader}>
                    <Text style={styles.utilisationLabel}>Credit Utilisation</Text>
                    <Text style={[styles.utilisationPct, { color: isOverLimit ? '#EF4444' : utilisationPct > 80 ? '#F59E0B' : '#2563EB' }]}>
                      {utilisationPct.toFixed(0)}%
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <LinearGradient
                      colors={isOverLimit ? ['#EF4444', '#F87171'] : utilisationPct > 80 ? ['#F59E0B', '#FBBF24'] : ['#2563EB', '#3B82F6']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressFill, { width: `${utilisationPct}%` }]}
                    />
                  </View>
                  <Text style={styles.creditLimitText}>
                    {isOverLimit ? `Over by ${formatPKR(displayBalance - displayCreditLimit)}` : `${formatPKR(displayCreditLimit - displayBalance)} available`}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* ============ STATS ROW (3 mini cards) ============ */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: '#DBEAFE' }]}>
                  <MaterialIcons name="trending-up" size={15} color="#2563EB" />
                </View>
                <Text style={styles.statLabel}>TOTAL CREDIT</Text>
                <Text style={[styles.statValue, { color: '#2563EB' }]} numberOfLines={1}>
                  {formatPKR(totalCredit)}
                </Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: '#D1FAE5' }]}>
                  <MaterialIcons name="trending-down" size={15} color="#10B981" />
                </View>
                <Text style={styles.statLabel}>TOTAL RECOVERY</Text>
                <Text style={[styles.statValue, { color: '#10B981' }]} numberOfLines={1}>
                  {formatPKR(totalRecovery)}
                </Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: '#FEF3C7' }]}>
                  <MaterialIcons name="history" size={15} color="#F59E0B" />
                </View>
                <Text style={styles.statLabel}>LAST VISIT</Text>
                <Text style={[styles.statValue, { color: '#0F172A', fontSize: FontSize.xs }]} numberOfLines={2}>
                  {lastVisitLabel}
                </Text>
              </View>
            </View>

            {/* ============ ACTION BUTTONS ROW (4 buttons) ============ */}
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.actionBtnPrimary, pressed && { opacity: 0.85 }]}
                onPress={() => { onClose(); onCollect(); }}
              >
                <MaterialIcons name="payments" size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnTextPrimary}>Recovery</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.actionBtnOutline, pressed && { opacity: 0.7 }]}
                onPress={handleCallPress}
              >
                <View style={styles.actionBtnIconCircle}>
                  <MaterialIcons name="call" size={16} color="#2563EB" />
                </View>
                <Text style={styles.actionBtnText}>Call</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.actionBtnOutline, pressed && { opacity: 0.7 }]}
                onPress={handleNavigatePress}
              >
                <View style={styles.actionBtnIconCircle}>
                  <MaterialIcons name="directions" size={16} color="#2563EB" />
                </View>
                <Text style={styles.actionBtnText}>Navigate</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.actionBtnOutline, pressed && { opacity: 0.7 }]}
                onPress={handleWhatsappPress}
              >
                <View style={styles.actionBtnIconCircle}>
                  <MaterialIcons name="chat" size={16} color="#2563EB" />
                </View>
                <Text style={styles.actionBtnText}>WhatsApp</Text>
              </Pressable>
            </View>

            {/* ============ 6-MONTH PERFORMANCE CHART ============ */}
            <View style={styles.chartCard}>
              <View style={styles.chartTitleRow}>
                <View>
                  <Text style={styles.sectionTitle}>6-Month Performance</Text>
                  <Text style={styles.chartSubtitle}>Recovery trend</Text>
                </View>
                <View style={styles.chartLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
                    <Text style={styles.legendText}>Recovery</Text>
                  </View>
                </View>
              </View>

              {chartLoading ? (
                <View style={styles.chartLoading}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.chartLoadingText}>Loading chart...</Text>
                </View>
              ) : !hasChartData ? (
                <View style={styles.chartEmpty}>
                  <Text style={styles.chartEmptyIcon}>📊</Text>
                  <Text style={styles.chartEmptyText}>No transaction history available</Text>
                </View>
              ) : (
                <BarChart
                  data={{
                    labels: chartData.labels,
                    datasets: [
                      {
                        data: chartData.recoveries.map((v) => Math.max(v, 0)),
                        color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
                      },
                    ],
                  }}
                  width={screenWidth - 80}
                  height={150}
                  yAxisLabel="Rs."
                  yAxisSuffix=""
                  chartConfig={{
                    backgroundColor: Colors.surface,
                    backgroundGradientFrom: Colors.surface,
                    backgroundGradientTo: Colors.surface,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                    barPercentage: 0.7,
                    propsForBackgroundLines: {
                      stroke: Colors.borderLight,
                    },
                  }}
                  style={{ borderRadius: Radius.md, marginLeft: -Spacing.md }}
                  showValuesOnTopOfBars={false}
                  withInnerLines
                  fromZero
                />
              )}
            </View>

            {/* ============ TRANSACTION HISTORY SECTION ============ */}
            <View style={styles.txnSectionHeader}>
              <View style={styles.txnSectionTitleRow}>
                <Text style={styles.sectionTitle}>Transaction History</Text>
                {recentTxns.length > 0 ? (
                  <View style={styles.countPill}>
                    <Text style={styles.countPillText}>{recentTxns.length}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.viewAllLink}>
                <Text style={styles.viewAllText}>View All</Text>
                <MaterialIcons name="chevron-right" size={14} color="#2563EB" />
              </View>
            </View>

            {/* ============ NOTES SECTION ============ */}
            <View style={styles.notesSection}>
              <View style={styles.notesHeader}>
                <View style={styles.notesHeaderLeft}>
                  <View style={styles.notesIconWrap}>
                    <MaterialIcons name="sticky-note-2" size={16} color="#F59E0B" />
                  </View>
                  <Text style={styles.sectionTitleInline}>Notes / Remarks</Text>
                </View>
                {shopNote ? (
                  <Pressable onPress={handleDeleteNote} hitSlop={8} style={styles.noteDeleteBtn}>
                    <MaterialIcons name="delete-outline" size={16} color="#EF4444" />
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.noteInputWrap}>
                <TextInput
                  style={styles.noteTextInput}
                  value={noteInput}
                  onChangeText={setNoteInput}
                  placeholder="Add a note about this shop..."
                  placeholderTextColor={Colors.textMuted}
                  maxLength={500}
                  multiline
                  numberOfLines={3}
                />
                {/* Speech-to-Text mic button */}
                <Pressable
                  onPress={toggleSpeechToText}
                  hitSlop={8}
                  style={[
                    styles.micButton,
                    speechToText.isListening && styles.micButtonActive,
                  ]}
                  accessibilityLabel={
                    speechToText.isListening ? 'Stop voice input' : 'Start voice input'
                  }
                  accessibilityRole="button"
                >
                  <MaterialIcons
                    name={speechToText.isListening ? 'stop' : 'mic'}
                    size={20}
                    color={speechToText.isListening ? '#FFFFFF' : AuroraColors.neonViolet}
                  />
                </Pressable>
              </View>
              {speechToText.error ? (
                <Text style={styles.speechErrorText}>{speechToText.error}</Text>
              ) : null}
              {speechToText.isListening ? (
                <Text style={styles.speechListeningText}>● Listening... tap mic to stop</Text>
              ) : null}
              <View style={styles.noteActions}>
                {shopNote ? (
                  <Text style={styles.noteUpdatedAt}>
                    Last updated: {formatDateTime(shopNote.updatedAt)}
                  </Text>
                ) : null}
                <Pressable
                  style={({ pressed }) => [styles.noteSaveBtn, pressed && { opacity: 0.7 }]}
                  onPress={handleSaveNote}
                  disabled={!noteInput.trim() || noteSaving}
                >
                  {noteSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <MaterialIcons name="save" size={14} color="#FFFFFF" />
                  )}
                  <Text style={styles.noteSaveBtnText}>
                    {noteSaving ? 'Saving...' : shopNote ? 'Update' : 'Save Note'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* ============ TRANSACTION ROWS ============ */}
            {loading ? (
              <ActivityIndicator color="#2563EB" style={{ marginVertical: Spacing.md }} />
            ) : recentTxns.length === 0 ? (
              <View style={styles.emptyTxnWrap}>
                <MaterialIcons name="receipt-long" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyTxn}>No transactions found</Text>
              </View>
            ) : (
              recentTxns.map((txn) => (
                <View key={txn.id} style={[
                  styles.txnRow,
                  txn.type === 'claim' && { backgroundColor: 'rgba(239, 68, 68, 0.06)', borderRadius: 10 },
                ]}>
                  <View style={[
                    styles.txnTypeIcon,
                    { backgroundColor: txn.type === 'credit' ? '#FEF3C7' : txn.type === 'claim' ? '#FEE2E2' : '#DBEAFE' },
                  ]}>
                    <MaterialIcons
                      name={txn.type === 'credit' ? 'arrow-downward' : txn.type === 'claim' ? 'remove-circle-outline' : 'arrow-upward'}
                      size={14}
                      color={txn.type === 'credit' ? '#F59E0B' : txn.type === 'claim' ? '#EF4444' : '#2563EB'}
                    />
                  </View>
                  <View style={styles.txnInfo}>
                    <View style={styles.txnInfoTop}>
                      <Text style={[
                        styles.txnType,
                        txn.type === 'claim' && { color: '#EF4444', fontWeight: 'bold' },
                      ]}>{txn.type === 'credit' ? 'Credit' : txn.type === 'claim' ? 'Claim' : 'Recovery'}</Text>
                      {txn.status === 'pending' ? (
                        <Badge label="Pending" bgColor="#FEF3C7" color="#92400E" size="sm" />
                      ) : txn.status === 'rejected' ? (
                        <Badge label="Rejected" bgColor={Colors.dangerLight} color={Colors.danger} size="sm" />
                      ) : null}
                    </View>
                    <Text style={styles.txnDate}>{formatDateTime(txn.createdAt)}</Text>
                    {txn.description ? (
                      <Text style={styles.txnDesc} numberOfLines={1}>{txn.description}</Text>
                    ) : null}
                  </View>
                  <View style={styles.txnAmountCol}>
                    <Text style={[
                      styles.txnAmount,
                      { color: txn.type === 'credit' ? '#F59E0B' : txn.type === 'claim' ? '#EF4444' : '#2563EB' },
                    ]}>
                      {formatPKR(txn.amount)}
                    </Text>
                    <Text style={styles.txnBalAfter}>{formatPKR(txn.newBalance)}</Text>
                    {/* Edit button for pending recoveries only — approved recoveries cannot be edited */}
                    {txn.type === 'recovery' && txn.status === 'pending' && onEditPendingRecovery ? (
                      <Pressable
                        style={styles.txnEditBtn}
                        onPress={() => onEditPendingRecovery(txn)}
                        hitSlop={6}
                      >
                        <MaterialIcons name="edit" size={14} color="#2563EB" />
                        <Text style={styles.txnEditBtnText}>Edit</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))
            )}

            <View style={{ height: Spacing.sm }} />
          </ScrollView>

          {/* ============ FOOTER: Post Recovery (+ optional Resend) ============ */}
          <View style={styles.footer}>
            {onResendReceipt && currentPhone ? (
              <View style={styles.footerButtonsRow}>
                <Pressable
                  style={({ pressed }) => [styles.collectBtn, { flex: 1 }, pressed && styles.collectBtnPressed]}
                  onPress={() => { onClose(); onCollect(); }}
                >
                  <MaterialIcons name="payments" size={20} color={Colors.textInverse} />
                  <Text style={styles.collectBtnText}>Post Recovery</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.resendBtn, pressed && styles.collectBtnPressed]}
                  onPress={onResendReceipt}
                >
                  <MaterialIcons name="chat" size={20} color="#FFFFFF" />
                  <Text style={styles.collectBtnText}>Resend Receipt</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.collectBtn, pressed && styles.collectBtnPressed]}
                onPress={() => { onClose(); onCollect(); }}
              >
                <MaterialIcons name="payments" size={20} color={Colors.textInverse} />
                <Text style={styles.collectBtnText}>Post Recovery</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* ============ PHONE EDIT MODAL ============ */}
        <Modal visible={editingPhone} transparent animationType="fade">
          <KeyboardAvoidingView
            style={styles.phoneEditBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.phoneEditCard}>
              <View style={styles.phoneEditHeader}>
                <View style={styles.phoneEditIconWrap}>
                  <MaterialIcons name="phone" size={22} color="#2563EB" />
                </View>
                <Text style={styles.phoneEditTitle}>Edit Phone & Owner</Text>
                <Text style={styles.phoneEditSubtitle}>{shop.name}</Text>
              </View>
              {/* Owner Name Input */}
              <View style={styles.phoneEditInputWrap}>
                <MaterialIcons name="person" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.phoneEditInput}
                  value={ownerNameInput}
                  onChangeText={setOwnerNameInput}
                  placeholder="Owner Name (e.g. Muhammad Ali)"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={50}
                />
                {ownerNameInput ? (
                  <Pressable onPress={() => setOwnerNameInput('')} hitSlop={8}>
                    <MaterialIcons name="cancel" size={16} color={Colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
              {/* Phone Input */}
              <View style={styles.phoneEditInputWrap}>
                <MaterialIcons name="call" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.phoneEditInput}
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  placeholder="e.g. 03001234567"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={15}
                  autoFocus
                />
                {phoneInput ? (
                  <Pressable onPress={() => setPhoneInput('')} hitSlop={8}>
                    <MaterialIcons name="cancel" size={16} color={Colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.phoneEditActions}>
                <Pressable
                  style={({ pressed }) => [styles.phoneEditCancelBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => { setEditingPhone(false); setPhoneInput(''); }}
                  disabled={phoneSaving}
                >
                  <Text style={styles.phoneEditCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.phoneEditSaveBtn,
                    (!phoneInput.trim() || phoneSaving) && styles.phoneEditSaveBtnDisabled,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={handleSavePhone}
                  disabled={!phoneInput.trim() || phoneSaving}
                >
                  {phoneSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <MaterialIcons name="check" size={16} color="#FFFFFF" />
                  )}
                  <Text style={styles.phoneEditSaveText}>
                    {phoneSaving ? 'Saving...' : 'Save'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '92%',
    ...Shadow.lg,
    overflow: 'hidden',
  },
  // ===== HERO HEADER =====
  heroHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
  },
  heroBubble1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -70,
    right: -50,
  },
  heroBubble2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -30,
    left: -30,
  },
  heroBubble3: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: 40,
    left: 30,
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.md,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...Shadow.sm,
  },
  heroIdentity: {
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.sm,
  },
  heroAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  heroAvatarText: {
    fontSize: 28,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  heroOverLimitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 2,
  },
  heroOverLimitText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  heroShopName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  heroOwner: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  // ===== Action pills row =====
  actionPillRow: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
    marginBottom: Spacing.sm,
  },
  actionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: Radius.full,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  actionPillPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  actionPillText: {
    fontSize: FontSize.xs,
    color: '#FFFFFF',
    fontWeight: FontWeight.semibold,
  },
  // ===== Hero address =====
  heroAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    alignSelf: 'center',
    maxWidth: '90%',
  },
  heroAddressText: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.92)',
    flex: 1,
  },
  // ===== Scroll content =====
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  // ===== Phone chip =====
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  phoneChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DBEAFE',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
  },
  phoneChipText: {
    fontSize: FontSize.xs,
    color: '#2563EB',
    fontWeight: FontWeight.semibold,
  },
  phoneEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
  },
  phoneEditText: {
    fontSize: FontSize.xs,
    color: '#2563EB',
    fontWeight: FontWeight.semibold,
  },
  noPhoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    marginBottom: Spacing.md,
    justifyContent: 'center',
  },
  noPhoneText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: '#D97706',
    fontWeight: FontWeight.semibold,
  },
  // ===== Balance breakdown card =====
  balanceCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  balanceCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  balanceCardLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: FontWeight.bold,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  balanceCardTotal: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  balanceCardLimitPill: {
    backgroundColor: '#DBEAFE',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    alignItems: 'flex-end',
  },
  balanceCardLimitLabel: {
    fontSize: 9,
    color: '#1E40AF',
    fontWeight: FontWeight.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  balanceCardLimitValue: {
    fontSize: FontSize.sm,
    color: '#1E40AF',
    fontWeight: FontWeight.bold,
    marginTop: 1,
  },
  // Per-company breakdown
  companyBreakdownList: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 2,
  },
  companyBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  companyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  companyName: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.text,
    fontWeight: FontWeight.medium,
  },
  companyBalance: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  // Utilisation
  utilisationSection: {
    gap: 6,
  },
  utilisationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  utilisationLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  utilisationPct: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: Radius.full,
  },
  creditLimitText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  // ===== Stats row =====
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 3,
    ...Shadow.sm,
  },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: FontWeight.bold,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  // ===== Action buttons row (4 buttons) =====
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  actionBtnPrimary: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    ...Shadow.md,
  },
  actionBtnOutline: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    paddingVertical: 10,
  },
  actionBtnIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: FontSize.xs,
    color: '#1E40AF',
    fontWeight: FontWeight.semibold,
  },
  actionBtnTextPrimary: {
    fontSize: FontSize.xs,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },
  // ===== Chart =====
  chartCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
    overflow: 'hidden',
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  chartSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  chartLegend: {
    gap: 4,
    alignItems: 'flex-end',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  chartLoading: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  chartLoadingText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  chartEmpty: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  chartEmptyIcon: {
    fontSize: 28,
  },
  chartEmptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  // ===== Transaction history section header =====
  txnSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  txnSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countPill: {
    backgroundColor: '#DBEAFE',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countPillText: {
    fontSize: FontSize.xs,
    color: '#1E40AF',
    fontWeight: FontWeight.bold,
  },
  viewAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontSize: FontSize.xs,
    color: '#2563EB',
    fontWeight: FontWeight.semibold,
  },
  // ===== Transaction rows =====
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.sm,
  },
  txnTypeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnInfo: {
    flex: 1,
    gap: 2,
  },
  txnInfoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txnType: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  txnDate: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  txnDesc: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  txnAmountCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  txnAmount: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  txnBalAfter: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  txnEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#DBEAFE',
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 2,
  },
  txnEditBtnText: {
    fontSize: FontSize.xs,
    color: '#2563EB',
    fontWeight: FontWeight.semibold,
  },
  emptyTxnWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  emptyTxn: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  // ===== Notes section =====
  notesSection: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  notesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  notesIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleInline: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  noteDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteInputWrap: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  noteTextInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.40)',
  },
  micButtonActive: {
    backgroundColor: AuroraColors.danger,
    borderColor: AuroraColors.danger,
    shadowColor: AuroraColors.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  speechErrorText: {
    fontSize: FontSize.xs,
    color: AuroraColors.danger,
    marginBottom: Spacing.xs,
    fontWeight: FontWeight.semibold,
  },
  speechListeningText: {
    fontSize: FontSize.xs,
    color: AuroraColors.neonViolet,
    marginBottom: Spacing.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.5,
  },
  noteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noteUpdatedAt: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    flex: 1,
  },
  noteSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.secondary,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  noteSaveBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  // ===== Footer =====
  footer: {
    padding: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  collectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#2563EB',
    borderRadius: 30,
    paddingVertical: 16,
    ...Shadow.md,
  },
  collectBtnPressed: { opacity: 0.85 },
  footerButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  resendBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#25D366',
    borderRadius: 30,
    paddingVertical: 16,
  },
  collectBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
  // ===== Phone Edit Modal =====
  phoneEditBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  phoneEditCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 380,
    ...Shadow.xl,
  },
  phoneEditHeader: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  phoneEditIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  phoneEditTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  phoneEditSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  phoneEditInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  phoneEditInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: 12,
  },
  phoneEditActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  phoneEditCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  phoneEditCancelText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  phoneEditSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: '#2563EB',
  },
  phoneEditSaveBtnDisabled: {
    opacity: 0.5,
  },
  phoneEditSaveText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
});
