// Powered by Finexa
// Strict SMS System: WhatsApp opens directly to shop number, confirmation required after return
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from '@/utils/captureRef';
import * as MediaLibrary from 'expo-media-library';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { sendRecoverySms } from '@/utils/sendRecoverySms';
import { formatPKR } from '@/utils/format';
import { ApiService } from '@/services/api';
import { StorageService } from '@/services/storage';

interface NotificationPayload {
  shopId?: string;
  shopPhone: string;
  shopName: string;
  shopAddress?: string;
  shopOwnerName?: string;
  openingBalance: number;
  recoveryAmount: number;
  remainingBalance: number;
  companyName?: string;
  orderbookerName?: string;
  distributorPhone?: string;
}

export type NotificationMethod = 'sms' | 'whatsapp';

interface NotificationChoiceProps {
  visible: boolean;
  payload: NotificationPayload | null;
  onDone: (method: NotificationMethod) => void;
}

/** Format phone to international format for WhatsApp (923001234567) */
function formatPhoneIntl(phone: string): string {
  let p = phone.trim().replace(/[^0-9]/g, '');
  if (p.startsWith('0')) p = p.substring(1);
  if (!p.startsWith('92')) p = '92' + p;
  return p.replace(/[^0-9]/g, '');
}

export function NotificationChoice({ visible, payload, onDone }: NotificationChoiceProps) {
  const [sending, setSending] = useState(false);
  const [smsStatus, setSmsStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [showConfirm, setShowConfirm] = useState(false);
  const [businessName, setBusinessName] = useState<string>('AL-FALAH TRADERS');

  // Fetch business name on mount
  useEffect(() => {
    (async () => {
      const cached = await StorageService.getBusinessName();
      if (cached) setBusinessName(cached);
    })();
  }, []);
  const [confirmWarning, setConfirmWarning] = useState(false);
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const receiptRef = useRef<View>(null);
  const whatsappOpenedAt = useRef<number | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const waitingForReturn = useRef(false);

  useEffect(() => {
    if (visible) {
      setSending(false);
      setSmsStatus('idle');
      setShowConfirm(false);
      setConfirmWarning(false);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.8);
      opacity.setValue(0);
      setShowConfirm(false);
      setConfirmWarning(false);
      waitingForReturn.current = false;
      whatsappOpenedAt.current = null;
    }
  }, [visible]);

  // Listen for app returning from WhatsApp
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active' &&
        waitingForReturn.current
      ) {
        // User returned from WhatsApp
        waitingForReturn.current = false;
        const timeSpent = whatsappOpenedAt.current ? Date.now() - whatsappOpenedAt.current : 0;
        whatsappOpenedAt.current = null;

        console.log('[NotificationChoice] Returned from WhatsApp, time spent:', timeSpent, 'ms');

        // Time detection: if < 3 seconds, likely didn't send
        const tooFast = timeSpent < 3000;
        setConfirmWarning(tooFast);
        setShowConfirm(true);
        setSending(false);
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  const today = new Date().toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  /** Build recovery text message */
  const buildRecoveryText = (p: NotificationPayload): string => {
    let msg = `Finexa Recovery App - Recovery Update\n\n`
      + `Dear ${p.shopName},\n\n`
      + `Your account has been updated:\n\n`
      + `Opening Balance: ${formatPKR(p.openingBalance)}\n`
      + `Recovery Received: ${formatPKR(p.recoveryAmount)}\n`
      + `Remaining Balance: ${formatPKR(p.remainingBalance)}\n\n`
      + `Date: ${today}\n`;
    if (p.distributorPhone) {
      msg += `\nDistributor No: ${p.distributorPhone}\n`;
    }
    msg += `\nThank you for your payment!\n`
      + `Finexa Recovery App`;
    return msg;
  };

  /** Open WhatsApp chat directly to shop's number with pre-filled text */
  const openWhatsAppDirect = async (phone: string, message: string): Promise<boolean> => {
    if (!phone || phone.trim().length === 0) return false;

    const formattedPhone = formatPhoneIntl(phone);
    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return true;
      } else {
        Alert.alert(
          'WhatsApp Not Available',
          'WhatsApp is not installed on this device. Please install WhatsApp or use SMS.',
        );
        return false;
      }
    } catch (e) {
      console.warn('[NotificationChoice] Could not open WhatsApp:', e);
      Alert.alert('Error', 'Could not open WhatsApp. Please try again.');
      return false;
    }
  };

  /** Save receipt image to gallery */
  const saveReceiptToGallery = async (): Promise<string | null> => {
    if (!receiptRef.current) return null;

    try {
      await new Promise(r => setTimeout(r, 300));
      const imageUri = await captureRef(receiptRef, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
      });

      if (imageUri) {
        console.log('[NotificationChoice] Receipt image captured:', imageUri);
        try {
          const { status } = await MediaLibrary.requestPermissionsAsync(true);
          if (status === 'granted') {
            const normalizedImgUri = imageUri.startsWith('file://') ? imageUri : `file://${imageUri}`;
            const asset = await MediaLibrary.createAssetAsync(normalizedImgUri);
            try {
              await MediaLibrary.createAlbumAsync('Finexa Receipts', asset, false);
            } catch {
              try {
                const album = await MediaLibrary.getAlbumAsync('Finexa Receipts');
                if (album) {
                  await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
                }
              } catch {}
            }
            console.log('[NotificationChoice] Receipt saved to gallery:', asset.uri);
          }
        } catch (galleryErr) {
          console.warn('[NotificationChoice] Could not save to gallery:', galleryErr);
        }
        return imageUri;
      }
    } catch (captureErr) {
      console.warn('[NotificationChoice] Image capture failed:', captureErr);
    }
    return null;
  };

  const handleSms = async () => {
    if (!payload) return;
    setSending(true);
    setSmsStatus('idle');
    try {
      // Fetch business name from storage for SMS
      const bName = await StorageService.getBusinessName() || undefined;
      const sent = await sendRecoverySms({ ...payload, businessName: bName });
      if (sent) {
        console.log('[NotificationChoice] SMS sent successfully');
        setSmsStatus('success');
        // Log to server — admin tracking
        try {
          const user = await StorageService.getUser();
          if (user) {
            await ApiService.logSms({
              shopId: payload.shopId || '',
              shopName: payload.shopName,
              shopPhone: payload.shopPhone,
              orderbookerId: user.id,
              method: 'sms',
              status: 'sent',
            });
          }
        } catch (logErr) {
          console.warn('[NotificationChoice] SMS log failed (non-blocking):', logErr);
        }
        // Small delay to show success state before closing
        setTimeout(() => {
          onDone('sms');
        }, 800);
      } else {
        console.warn('[NotificationChoice] SMS failed to send');
        setSmsStatus('failed');
        // Log failure to server
        try {
          const user = await StorageService.getUser();
          if (user) {
            await ApiService.logSms({
              shopId: payload.shopId || '',
              shopName: payload.shopName,
              shopPhone: payload.shopPhone,
              orderbookerId: user.id,
              method: 'sms',
              status: 'failed',
              errorMessage: 'SMS send returned false',
            });
          }
        } catch {}
        // DON'T call onDone — keep in pending
        Alert.alert(
          'SMS Bhejne Mein Masla',
          'SMS bhej nahi saka. WhatsApp try karein ya dobara koshish karein.\n\nYe receipt Pending mein rahegi jab tak message send nahi hota.',
          [
            { text: 'WhatsApp Try Karo', onPress: () => { setSmsStatus('idle'); setSending(false); } },
            { text: 'Baad Mein Bhejunga', onPress: () => { setSmsStatus('idle'); setSending(false); } },
          ]
        );
      }
    } catch (err) {
      console.error('[NotificationChoice] SMS error:', err);
      setSmsStatus('failed');
      // Log error to server
      try {
        const user = await StorageService.getUser();
        if (user) {
          await ApiService.logSms({
            shopId: payload.shopId || '',
            shopName: payload.shopName,
            shopPhone: payload.shopPhone,
            orderbookerId: user.id,
            method: 'sms',
            status: 'failed',
            errorMessage: (err as any)?.message || 'Unknown error',
          });
        }
      } catch {}
      // DON'T call onDone — keep in pending
      Alert.alert(
        'SMS Error',
        'SMS bhejne mein error aaya. WhatsApp try karein.\n\nYe receipt Pending mein rahegi.',
        [
          { text: 'WhatsApp Try Karo', onPress: () => { setSmsStatus('idle'); setSending(false); } },
          { text: 'Baad Mein Bhejunga', onPress: () => { setSmsStatus('idle'); setSending(false); } },
        ]
      );
    }
    setSending(false);
  };

  const handleWhatsapp = async () => {
    if (!payload) return;
    setSending(true);

    try {
      // Step 1: Save receipt image to gallery (so OB can attach it in WhatsApp)
      await saveReceiptToGallery();

      // Step 2: Build text message
      const textMessage = buildRecoveryText(payload);

      // Step 3: Open WhatsApp directly to shop's number with pre-filled text
      const opened = await openWhatsAppDirect(payload.shopPhone, textMessage);

      if (opened) {
        // Record when WhatsApp was opened for time detection
        whatsappOpenedAt.current = Date.now();
        waitingForReturn.current = true;
        // Don't call onDone yet — wait for user to return from WhatsApp
        // AppState listener will handle the confirmation dialog
        console.log('[NotificationChoice] WhatsApp opened, waiting for return...');
      } else {
        // WhatsApp couldn't open — keep in pending
        setSending(false);
      }
    } catch (err) {
      console.error('[NotificationChoice] WhatsApp error:', err);
      setSending(false);
    }
  };

  /** User confirmed they sent the WhatsApp message */
  const handleConfirmSent = useCallback(async () => {
    console.log('[NotificationChoice] User confirmed WhatsApp sent');
    setShowConfirm(false);
    // CRITICAL: Log SMS BEFORE calling onDone — onDone closes the modal
    // which sets payload to null. If we call onDone first, the await
    // below yields to event loop, React re-renders, payload becomes null,
    // and logSms() is SKIPPED.
    try {
      const user = await StorageService.getUser();
      if (user && payload) {
        await ApiService.logSms({
          shopId: payload.shopId || '',
          shopName: payload.shopName,
          shopPhone: payload.shopPhone,
          orderbookerId: user.id,
          method: 'whatsapp',
          status: 'sent',
        });
        console.log('[NotificationChoice] WhatsApp log sent to server');
      }
    } catch (e) {
      console.warn('[NotificationChoice] WhatsApp log failed (non-blocking):', e);
    }
    // NOW call onDone — modal will close
    onDone('whatsapp');
  }, [onDone, payload]);

  /** User denied sending — keep in pending */
  const handleDenySent = useCallback(async () => {
    console.log('[NotificationChoice] User denied sending — keeping in pending');
    setShowConfirm(false);
    setSending(false);
    // Log WhatsApp skipped BEFORE onDone (same fix as handleConfirmSent)
    try {
      const user = await StorageService.getUser();
      if (user && payload) {
        await ApiService.logSms({
          shopId: payload.shopId || '',
          shopName: payload.shopName,
          shopPhone: payload.shopPhone,
          orderbookerId: user.id,
          method: 'whatsapp',
          status: 'skipped',
          errorMessage: 'User denied sending WhatsApp',
        });
        console.log('[NotificationChoice] WhatsApp skip log sent to server');
      }
    } catch (e) {
      console.warn('[NotificationChoice] WhatsApp skip log failed (non-blocking):', e);
    }
    // NOW close the modal
    onDone('_keep_pending' as NotificationMethod);
  }, [onDone, payload]);

  /** Close button — keep receipt in pending state */
  const handleClose = useCallback(() => {
    if (sending) return;
    onDone('_keep_pending' as NotificationMethod);
  }, [onDone, sending]);

  if (!payload) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <Pressable style={styles.backdrop} disabled={sending}>
        <Animated.View style={[styles.backdropFade, { opacity }]} />
      </Pressable>

      <View style={styles.center}>
        <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
          {/* Close button */}
          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
            onPress={handleClose}
            disabled={sending}
            hitSlop={12}
          >
            <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>

          {/* ── Receipt (visible + capturable via ref) ── */}
          <View ref={receiptRef} collapsable={false} style={styles.receiptCard}>
            {/* 1. Blue gradient header with business name */}
            <LinearGradient
              colors={['#1E40AF', '#2563EB', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.receiptHeader}
            >
              <View style={styles.receiptHeaderIconWrap}>
                <MaterialIcons name="account-balance" size={26} color="#FFFFFF" />
              </View>
              <Text style={styles.receiptSystemTitle}>{businessName}</Text>
              {payload.companyName ? (
                <Text style={styles.receiptCompanyName}>{payload.companyName}</Text>
              ) : null}
            </LinearGradient>

            {/* Receipt body */}
            <View style={styles.receiptBody}>
              {/* 3. Payment Receipt label */}
              <Text style={styles.receiptPaymentLabel}>Payment Receipt</Text>

              {/* 4. Distributor Number */}
              {payload.distributorPhone ? (
                <View style={styles.receiptDistPhoneRow}>
                  <MaterialIcons name="call" size={15} color="#2563EB" />
                  <Text style={styles.receiptDistPhoneLabel}>Distributor No:</Text>
                  <Text style={styles.receiptDistPhoneValue}>{payload.distributorPhone}</Text>
                </View>
              ) : null}

              {/* Divider */}
              <View style={styles.receiptDivider} />

              {/* 5. Shop details with icons */}
              <View style={styles.receiptShopSection}>
                <View style={styles.receiptInfoRow}>
                  <View style={styles.receiptInfoIconWrap}>
                    <MaterialIcons name="store" size={15} color="#2563EB" />
                  </View>
                  <Text style={styles.receiptInfoLabel}>Shop</Text>
                  <Text style={styles.receiptInfoValue}>{payload.shopName}</Text>
                </View>
                {payload.shopAddress ? (
                  <View style={styles.receiptInfoRow}>
                    <View style={styles.receiptInfoIconWrap}>
                      <MaterialIcons name="location-on" size={15} color="#2563EB" />
                    </View>
                    <Text style={styles.receiptInfoLabel}>Address</Text>
                    <Text style={styles.receiptInfoValue}>{payload.shopAddress}</Text>
                  </View>
                ) : null}
                {payload.shopOwnerName ? (
                  <View style={styles.receiptInfoRow}>
                    <View style={styles.receiptInfoIconWrap}>
                      <MaterialIcons name="person" size={15} color="#2563EB" />
                    </View>
                    <Text style={styles.receiptInfoLabel}>Owner</Text>
                    <Text style={styles.receiptInfoValue}>{payload.shopOwnerName}</Text>
                  </View>
                ) : null}
                <View style={styles.receiptInfoRow}>
                  <View style={styles.receiptInfoIconWrap}>
                    <MaterialIcons name="calendar-today" size={15} color="#2563EB" />
                  </View>
                  <Text style={styles.receiptInfoLabel}>Date</Text>
                  <Text style={styles.receiptInfoValue}>{today}</Text>
                </View>
              </View>

              {/* 6. Orderbooker */}
              {payload.orderbookerName ? (
                <View style={styles.receiptOrderbookerSection}>
                  <View style={styles.receiptInfoIconWrap}>
                    <MaterialIcons name="badge" size={15} color="#2563EB" />
                  </View>
                  <Text style={styles.receiptOrderbookerLabel}>Orderbooker</Text>
                  <Text style={styles.receiptOrderbookerValue}>{payload.orderbookerName}</Text>
                </View>
              ) : null}

              {/* 7. Amount details box */}
              <View style={styles.receiptAmountBox}>
                <View style={styles.receiptAmountRow}>
                  <Text style={styles.receiptAmountLabel}>Opening Balance</Text>
                  <Text style={styles.receiptAmountVal}>{formatPKR(payload.openingBalance)}</Text>
                </View>
                <View style={styles.receiptAmtSep} />
                <View style={styles.receiptAmountRow}>
                  <Text style={styles.receiptAmountLabel}>Payment Received</Text>
                  <Text style={[styles.receiptAmountVal, { color: '#10B981' }]}>
                    {formatPKR(payload.recoveryAmount)}
                  </Text>
                </View>
                <View style={styles.receiptAmtSep} />
                <View style={[styles.receiptAmountRow, styles.receiptRemainingRow]}>
                  <Text style={[styles.receiptAmountLabel, { color: '#92400E', fontWeight: FontWeight.bold }]}>
                    Remaining Balance
                  </Text>
                  <Text style={[styles.receiptAmountVal, { color: '#B45309', fontSize: 20 }]}>
                    {formatPKR(payload.remainingBalance)}
                  </Text>
                </View>
              </View>

              {/* 8. Success badge */}
              <View style={styles.receiptSuccessBadge}>
                <View style={styles.receiptSuccessIconWrap}>
                  <MaterialIcons name="check" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.receiptThankText}>Thank you for your Payment!</Text>
              </View>

              {/* 9. Urdu hidayat */}
              <View style={styles.receiptHidayat}>
                <Text style={styles.receiptHidayatText}>
                  اگر آپ کو کسی بھی قسم کا کوئی فرق محسوس ہوتا ہے بیلنس میں تو اوپر دیے گئے نمبر پر لازمی رابطہ کریں شکریہ
                </Text>
              </View>
            </View>
          </View>

          {/* Mandatory note */}
          <Text style={styles.mandatoryNote}>
            * Notification is compulsory for every recovery
          </Text>

          {/* SMS Button (blue) */}
          <Pressable
            style={({ pressed }) => [styles.btnSms, pressed && styles.btnPressed]}
            onPress={handleSms}
            disabled={sending}
          >
            <View style={styles.btnGradient}>
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="sms" size={22} color="#FFFFFF" />
                  <View style={styles.btnTextWrap}>
                    <Text style={styles.btnTitle}>Send via SMS</Text>
                    <Text style={styles.btnSub}>Direct send from SIM (no app opens)</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
                </>
              )}
            </View>
          </Pressable>

          {/* WhatsApp Button (green) */}
          <Pressable
            style={({ pressed }) => [styles.btnWhatsapp, pressed && styles.btnPressed]}
            onPress={handleWhatsapp}
            disabled={sending}
          >
            <View style={styles.btnWhatsappGradient}>
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="chat" size={22} color="#FFFFFF" />
                  <View style={styles.btnTextWrap}>
                    <Text style={styles.btnTitle}>Send via WhatsApp</Text>
                    <Text style={styles.btnSub}>Receipt picture + message on WhatsApp</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
                </>
              )}
            </View>
          </Pressable>

          {/* Gallery hint */}
          <View style={styles.galleryHint}>
            <MaterialIcons name="photo-library" size={14} color={Colors.textSecondary} />
            <Text style={styles.galleryHintText}>
              Receipt image gallery mein save ho gayi hai — WhatsApp mein attach karein
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* ── WhatsApp Confirmation Dialog ── */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            {/* Warning icon */}
            <View style={[styles.confirmIconWrap, confirmWarning && styles.confirmIconWrapWarning]}>
              <MaterialIcons
                name={confirmWarning ? 'warning' : 'help-outline'}
                size={36}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.confirmTitle}>
              {confirmWarning ? 'Lagta Hai Message Nahi Bheja!' : 'Kya Message Bhej Diya?'}
            </Text>

            <Text style={styles.confirmSubtitle}>
              {confirmWarning
                ? 'Aap bohot jaldi wapas aaye. Kya aapne WhatsApp pe message bhej diya? Agar nahi bheja toh ye receipt Pending mein rahegi.'
                : 'Kya aapne WhatsApp pe message bhej diya? Agar nahi bheja toh ye receipt Pending mein rahegi.'
              }
            </Text>

            {/* Confirm buttons */}
            <Pressable
              style={({ pressed }) => [styles.confirmBtnYes, pressed && styles.btnPressed]}
              onPress={handleConfirmSent}
            >
              <View style={styles.confirmBtnYesGradient}>
                <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
                <Text style={styles.confirmBtnYesText}>Haan, Bhej Diya</Text>
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.confirmBtnNo, pressed && styles.btnPressed]}
              onPress={handleDenySent}
            >
              <View style={styles.confirmBtnNoGradient}>
                <MaterialIcons name="cancel" size={20} color="#FFFFFF" />
                <Text style={styles.confirmBtnNoText}>Nahi, Abhi Bhejna Hai</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backdropFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    zIndex: 1,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    width: '100%',
    maxWidth: 380,
    ...Shadow.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },

  // Close button
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  // ── Receipt (visible + capturable) ──
  receiptCard: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginBottom: Spacing.sm,
  },
  // Blue gradient header
  receiptHeader: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  receiptHeaderIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  receiptSystemTitle: {
    fontSize: 19,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 1,
    textAlign: 'center',
  },
  receiptCompanyName: {
    fontSize: 14,
    fontWeight: FontWeight.semibold,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 2,
  },

  // Receipt body (white)
  receiptBody: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  // Payment Receipt label
  receiptPaymentLabel: {
    fontSize: 13,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 10,
  },
  // Distributor phone row
  receiptDistPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
    backgroundColor: '#DBEAFE',
    borderRadius: Radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  receiptDistPhoneLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  receiptDistPhoneValue: {
    fontSize: 13,
    color: '#1E40AF',
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  // Shop details section
  receiptShopSection: {
    marginBottom: 8,
  },
  receiptInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  receiptInfoIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptInfoLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
    width: 62,
  },
  receiptInfoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    textAlign: 'left',
  },
  // Orderbooker section
  receiptOrderbookerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  receiptOrderbookerLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  receiptOrderbookerValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  // Amount box
  receiptAmountBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    padding: 14,
    marginTop: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  receiptAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  receiptAmountLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  receiptAmountVal: {
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  receiptAmtSep: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 3,
  },
  receiptRemainingRow: {
    backgroundColor: '#FEF3C7',
    marginHorizontal: -14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    marginTop: 4,
  },
  // Success badge
  receiptSuccessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
    backgroundColor: '#D1FAE5',
    borderRadius: Radius.full,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'center',
  },
  receiptSuccessIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptThankText: {
    fontSize: 14,
    color: '#065F46',
    fontWeight: FontWeight.bold,
  },
  // Urdu Hidayat
  receiptHidayat: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  receiptHidayatText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    lineHeight: 21,
  },

  // Mandatory note
  mandatoryNote: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
    fontWeight: FontWeight.medium,
  },

  // SMS Button
  btnSms: {
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#2563EB',
  },
  // WhatsApp Button
  btnWhatsapp: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  btnWhatsappGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#25D366',
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnTextWrap: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  btnTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  btnSub: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },

  // Gallery hint
  galleryHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  galleryHintText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },

  // ── Confirmation Dialog Styles ──
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  confirmCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    ...Shadow.xl,
  },
  confirmIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  confirmIconWrapWarning: {
    backgroundColor: '#F59E0B',
  },
  confirmTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  confirmSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  confirmBtnYes: {
    borderRadius: Radius.md,
    width: '100%',
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  confirmBtnYesGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#25D366',
  },
  confirmBtnYesText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  confirmBtnNo: {
    borderRadius: Radius.md,
    width: '100%',
    overflow: 'hidden',
  },
  confirmBtnNoGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.danger,
  },
  confirmBtnNoText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
});
