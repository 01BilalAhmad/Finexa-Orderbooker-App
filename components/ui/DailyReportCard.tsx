import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { captureRef } from '@/utils/captureRef';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { getTodayLabel, formatPKR } from '@/utils/format';


interface CompanyBreakdownItem {
  companyId: string;
  companyName: string;
  totalRecovery: number;
  shops: number;
}

interface DailyReportProps {
  visible: boolean;
  onClose: () => void;
  shopsVisited: number;
  totalShops: number;
  totalRecovery: number;
  totalOutstanding?: number;
  smsSent: number;
  whatsappSent: number;
  pendingMessages: number;
  orderbookerName: string;
  companyBreakdown?: CompanyBreakdownItem[];
  selectedCompanyName?: string;
}

// Color palette for company-wise breakdown dots
const COMPANY_DOT_COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899'];

export function DailyReportCard({
  visible,
  onClose,
  shopsVisited,
  totalShops,
  totalRecovery,
  totalOutstanding = 0,
  smsSent,
  whatsappSent,
  pendingMessages,
  orderbookerName,
  companyBreakdown = [],
  selectedCompanyName,
}: DailyReportProps) {
  const cardRef = useRef<View>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const totalMessages = smsSent + whatsappSent;
  const todayLabel = getTodayLabel();
  const visitPct = totalShops > 0 ? Math.round((shopsVisited / totalShops) * 100) : 0;

  // Recovery progress: how much of total outstanding was recovered today
  const recoveryPct = totalOutstanding > 0 ? Math.min(Math.round((totalRecovery / totalOutstanding) * 100), 100) : 0;

  const buildTextMessage = () => {
    const lines = [
      `*Finexa Recovery App*`,
      `Daily Recovery Report`,
      ``,
      `${todayLabel}`,
      `${orderbookerName}`,
      ``,
      `Shops: ${shopsVisited}/${totalShops} visited (${visitPct}%)`,
      `Recovery: ${formatPKR(totalRecovery)}`,
    ];
    // Add company-wise breakdown in text message
    if (companyBreakdown.length > 0) {
      lines.push('');
      lines.push('*Company-wise Recovery:*');
      for (const cb of companyBreakdown) {
        lines.push(`  - ${cb.companyName}: ${formatPKR(cb.totalRecovery)} (${cb.shops} shops)`);
      }
    }
    lines.push('');
    lines.push(`SMS Shops: ${smsSent} | WA Shops: ${whatsappSent}`);
    if (pendingMessages > 0) lines.push(`${pendingMessages} pending`);
    lines.push('');
    lines.push('Powered by Finexa Recovery App');
    return lines.filter((l): l is string => true).join('\n');
  };

  const handleShareAsImage = async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    try {
      // Small delay to ensure layout is rendered
      await new Promise(r => setTimeout(r, 300));

      // Capture the card as a PNG image
      const imageUri = await captureRef(cardRef, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
      });

      if (!imageUri) {
        throw new Error('Image capture returned empty URI');
      }

      console.log('[DailyReport] Image captured at:', imageUri);

      // Use expo-sharing to open share sheet (WhatsApp, etc.)
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing not available on this device');
      }

      await Sharing.shareAsync(imageUri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Daily Report',
        UTI: 'public.png',
      });
    } catch (error: any) {
      console.error('[DailyReport] Image capture/share failed:', error);

      // Fallback: Share as text via WhatsApp directly
      Alert.alert(
        'Image Share Failed',
        'Picture share nahi hua. Kya WhatsApp pe text bhejna hai?',
        [
          {
            text: 'WhatsApp Text Bhejo',
            onPress: () => {
              const msg = encodeURIComponent(buildTextMessage());
              Linking.openURL(`https://wa.me/?text=${msg}`);
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } finally {
      setIsCapturing(false);
    }
  };

  /**
   * Share report as text message via WhatsApp
   */
  const handleShareAsText = async () => {
    try {
      const msg = encodeURIComponent(buildTextMessage());
      const url = `https://wa.me/?text=${msg}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('WhatsApp Not Available', 'Please install WhatsApp to share.');
      }
    } catch (error: any) {
      console.error('[DailyReport] Text share failed:', error);
      Alert.alert('Share Failed', 'Could not open WhatsApp. Please try again.');
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.backdropFade} />
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'android' ? undefined : 'padding'}
        style={styles.keyboardWrap}
      >
        <ScrollView
          contentContainerStyle={styles.scrollCenter}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            {/* ════════════════════════════════════════════ */}
            {/* MODAL HEADER (not captured)                    */}
            {/* ════════════════════════════════════════════ */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitle}>
                <MaterialIcons name="description" size={18} color="#2563EB" />
                <Text style={styles.modalHeaderTitleText}>Daily Recovery Report</Text>
              </View>
              <Pressable style={styles.modalHeaderClose} onPress={onClose} hitSlop={12}>
                <MaterialIcons name="close" size={18} color="#475569" />
              </Pressable>
            </View>

            {/* ════════════════════════════════════════════ */}
            {/* SHAREABLE CARD — captured as image (cardRef)  */}
            {/* ════════════════════════════════════════════ */}
            <View ref={cardRef} collapsable={false} style={styles.card}>
              {/* ── Blue Gradient Header ── */}
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderOverlay} />
                <View style={styles.brandRow}>
                  <View style={styles.brandLogo}>
                    <Text style={styles.brandLogoText}>F</Text>
                  </View>
                  <Text style={styles.brandName}>Finexa Recovery App</Text>
                </View>
                <Text style={styles.cardDate}>{todayLabel}</Text>
                <Text style={styles.cardName}>{orderbookerName}</Text>
              </View>

              {/* ── White Body ── */}
              <View style={styles.cardBody}>
                {/* ── Block 1: Visit Progress ── */}
                <View style={styles.block}>
                  <Text style={styles.blockLab}>SHOPS VISITED</Text>
                  <View style={styles.blockBigRow}>
                    <Text style={styles.blockBigVal}>{shopsVisited}</Text>
                    <Text style={styles.blockBigSub}>/{totalShops}</Text>
                    <Text style={styles.blockPct}>({visitPct}%)</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.min(visitPct, 100)}%` }]} />
                  </View>
                </View>

                {/* ── Block 2: Recovery Summary ── */}
                <View style={styles.block}>
                  <Text style={styles.blockLab}>TODAY&apos;S RECOVERY</Text>
                  <Text style={styles.recoveryBig}>{formatPKR(totalRecovery)}</Text>
                  <Text style={styles.recoverySub}>
                    of {formatPKR(totalOutstanding)} outstanding ({recoveryPct}%)
                  </Text>
                  <View style={styles.progressTrackSm}>
                    <View style={[styles.progressFillSm, { width: `${recoveryPct}%` }]} />
                  </View>
                </View>

                {/* ── Block 3: Company-wise Breakdown ── */}
                {companyBreakdown.length > 0 ? (
                  <View style={styles.block}>
                    <View style={styles.coTitleRow}>
                      <MaterialIcons name="business" size={13} color="#2563EB" />
                      <Text style={styles.coTitle}>Company-wise Recovery</Text>
                    </View>
                    {companyBreakdown.map((cb, idx) => {
                      const dotColor = COMPANY_DOT_COLORS[idx % COMPANY_DOT_COLORS.length];
                      return (
                        <View key={cb.companyId} style={styles.coRow}>
                          <View style={styles.coLeft}>
                            <View style={[styles.coDot, { backgroundColor: dotColor }]} />
                            <Text style={styles.coName} numberOfLines={1}>{cb.companyName}</Text>
                          </View>
                          <View style={styles.coRight}>
                            <Text style={styles.coAmt}>{formatPKR(cb.totalRecovery)}</Text>
                            <Text style={styles.coShops}>
                              {cb.shops} shop{cb.shops !== 1 ? 's' : ''}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {/* ── Block 4: Messages ── */}
                <View style={styles.block}>
                  <Text style={styles.blockLab}>MESSAGES SENT</Text>
                  <View style={styles.msgRow}>
                    <View style={styles.msgPill}>
                      <MaterialIcons name="sms" size={12} color="#1D4ED8" />
                      <Text style={styles.msgPillText}>SMS: {smsSent}</Text>
                    </View>
                    <View style={styles.msgPill}>
                      <MaterialIcons name="chat" size={12} color="#1D4ED8" />
                      <Text style={styles.msgPillText}>WhatsApp: {whatsappSent}</Text>
                    </View>
                    {pendingMessages > 0 ? (
                      <View style={styles.msgPillAmber}>
                        <MaterialIcons name="schedule" size={12} color="#B45309" />
                        <Text style={styles.msgPillAmberText}>{pendingMessages} pending</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* ── Footer ── */}
                <View style={styles.cardFooter}>
                  <Text style={styles.cardFooterText}>Powered by Finexa Recovery App</Text>
                </View>
              </View>
            </View>

            {/* ════════════════════════════════════════════ */}
            {/* ACTION BUTTONS (not captured)                  */}
            {/* ════════════════════════════════════════════ */}
            <View style={styles.actions}>
              {/* Share as Image — blue gradient */}
              <Pressable
                style={({ pressed }) => [
                  styles.shareImgBtn,
                  isCapturing && styles.shareImgBtnDisabled,
                  pressed && !isCapturing && { opacity: 0.9 },
                ]}
                onPress={handleShareAsImage}
                disabled={isCapturing}
              >
                {isCapturing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialIcons name="share" size={17} color="#FFFFFF" />
                )}
                <Text style={styles.shareImgBtnText}>
                  {isCapturing ? 'Generating Image...' : 'Share as Image'}
                </Text>
              </Pressable>

              {/* Share as Text (WhatsApp) — green outline */}
              <Pressable
                style={({ pressed }) => [styles.shareTextBtn, pressed && { opacity: 0.85 }]}
                onPress={handleShareAsText}
              >
                <MaterialIcons name="chat" size={17} color="#16A34A" />
                <Text style={styles.shareTextBtnText}>Share as Text (WhatsApp)</Text>
              </Pressable>

              {/* Close — text button */}
              <Pressable
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
                onPress={onClose}
              >
                <Text style={styles.closeBtnText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// Modern Blue Theme Colors
// ═══════════════════════════════════════════════════════════
const C = {
  blue900: '#1E40AF',
  blue800: '#1D4ED8',
  blue700: '#2563EB',
  blue600: '#3B82F6',
  blue500: '#60A5FA',
  blue100: '#DBEAFE',
  blue50: '#EFF6FF',
  green600: '#16A34A',
  green500: '#22C55E',
  green100: '#DCFCE7',
  amber600: '#D97706',
  amber800: '#B45309',
  amber100: '#FEF3C7',
  amber50: '#FFFBEB',
  gray900: '#0F172A',
  gray700: '#334155',
  gray600: '#475569',
  gray500: '#64748B',
  gray400: '#94A3B8',
  gray300: '#CBD5E1',
  gray200: '#E2E8F0',
  gray100: '#F1F5F9',
  gray50: '#F8FAFC',
  white: '#FFFFFF',
  appBg: '#F1F5F9',
  appBorder: '#E2E8F0',
  overlay: 'rgba(15, 23, 42, 0.8)',
};

const styles = StyleSheet.create({
  // ===== BACKDROP =====
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backdropFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.overlay,
  },

  // ===== SCROLL / LAYOUT =====
  keyboardWrap: {
    flex: 1,
  },
  scrollCenter: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    zIndex: 1,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    position: 'relative',
  },

  // ═══════════════════════════════════════════
  // MODAL HEADER (not captured)
  // ═══════════════════════════════════════════
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.white,
    borderRadius: 16,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.appBorder,
    ...Shadow.sm,
  },
  modalHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalHeaderTitleText: {
    fontSize: 15,
    fontWeight: FontWeight.bold,
    color: C.gray900,
  },
  modalHeaderClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ═══════════════════════════════════════════
  // SHAREABLE CARD (captured via cardRef)
  // ═══════════════════════════════════════════
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.appBorder,
    ...Shadow.lg,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 10,
  },

  // ── Blue Gradient Header ──
  cardHeader: {
    backgroundColor: C.blue900,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  cardHeaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.blue600,
    opacity: 0.35,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 1,
  },
  brandLogo: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoText: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
    color: C.white,
  },
  brandName: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    color: 'rgba(255,255,255,0.9)',
  },
  cardDate: {
    fontSize: 13,
    fontWeight: FontWeight.semibold,
    color: 'rgba(255,255,255,0.95)',
    marginTop: 10,
    zIndex: 1,
  },
  cardName: {
    fontSize: 22,
    fontWeight: FontWeight.bold,
    color: C.white,
    marginTop: 2,
    letterSpacing: -0.3,
    zIndex: 1,
  },

  // ── White Body ──
  cardBody: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: C.white,
  },

  // ── Blocks ──
  block: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: C.appBorder,
    borderStyle: 'dashed',
  },
  blockLab: {
    fontSize: 11,
    color: C.gray500,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  blockBigRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  blockBigVal: {
    fontSize: 22,
    fontWeight: FontWeight.bold,
    color: C.gray900,
    letterSpacing: -0.3,
  },
  blockBigSub: {
    fontSize: 18,
    color: C.gray400,
    fontWeight: FontWeight.semibold,
  },
  blockPct: {
    fontSize: 12,
    color: C.gray500,
    fontWeight: FontWeight.semibold,
  },

  // ── Progress bars ──
  progressTrack: {
    height: 8,
    backgroundColor: C.gray100,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: C.blue700,
  },
  progressTrackSm: {
    height: 5,
    backgroundColor: C.gray100,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFillSm: {
    height: 5,
    borderRadius: 999,
    backgroundColor: C.blue600,
  },

  // ── Recovery summary ──
  recoveryBig: {
    fontSize: 22,
    fontWeight: FontWeight.bold,
    color: C.blue700,
    letterSpacing: -0.3,
  },
  recoverySub: {
    fontSize: 11,
    color: C.gray500,
    fontWeight: FontWeight.medium,
    marginTop: 4,
  },

  // ── Company-wise breakdown ──
  coTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  coTitle: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
    color: C.gray900,
  },
  coRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: C.appBorder,
  },
  coLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  coDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  coName: {
    fontSize: 12,
    color: C.gray700,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  coRight: {
    alignItems: 'flex-end',
  },
  coAmt: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
    color: C.gray900,
  },
  coShops: {
    fontSize: 10,
    color: C.gray500,
    fontWeight: FontWeight.medium,
    marginTop: 1,
  },

  // ── Messages ──
  msgRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  msgPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.blue50,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  msgPillText: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    color: C.blue800,
  },
  msgPillAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.amber50,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  msgPillAmberText: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    color: C.amber800,
  },

  // ── Card Footer ──
  cardFooter: {
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: C.appBorder,
    marginTop: 4,
  },
  cardFooterText: {
    fontSize: 10,
    color: C.gray500,
    fontWeight: FontWeight.medium,
  },

  // ═══════════════════════════════════════════
  // ACTION BUTTONS (not captured)
  // ═══════════════════════════════════════════
  actions: {
    marginTop: 12,
    paddingHorizontal: 4,
    paddingBottom: 8,
    gap: 8,
  },

  // Share as Image — blue gradient
  shareImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.blue700,
    borderRadius: 12,
    paddingVertical: 13,
    ...Shadow.md,
    shadowColor: C.blue700,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  shareImgBtnDisabled: {
    opacity: 0.7,
  },
  shareImgBtnText: {
    fontSize: 14,
    fontWeight: FontWeight.semibold,
    color: C.white,
  },

  // Share as Text (WhatsApp) — green outline
  shareTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: C.green600,
    borderRadius: 12,
    paddingVertical: 12,
  },
  shareTextBtnText: {
    fontSize: 14,
    fontWeight: FontWeight.semibold,
    color: C.green600,
  },

  // Close — text button
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: FontWeight.semibold,
    color: C.gray500,
  },
});
