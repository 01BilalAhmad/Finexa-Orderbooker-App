// Powered by Finexa
// Strict SMS System: WhatsApp opens directly to shop number, confirmation required after return
// Receipt design matches RecoveryReceipt.tsx EXACTLY (Modern Blue design) so that the
// captured receipt image is identical whether shown here or via RecoveryReceipt.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
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

/** Build a receipt-number like "#RC-2026-00847" (year + 5-digit pseudo-sequential). */
function buildReceiptNumber(d: Date): string {
  const year = d.getFullYear();
  // Pseudo-sequential 5-digit seed from month/day/hour/minute (00000..44639)
  const seed =
    d.getMonth() * 31 * 24 * 60 +
    d.getDate() * 24 * 60 +
    d.getHours() * 60 +
    d.getMinutes();
  const seq = String(seed).padStart(5, '0');
  return `RC-${year}-${seq}`;
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

  const timeNow = new Date().toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // Receipt number for display — looks like "#RC-2026-00847"
  const receiptNumber = buildReceiptNumber(new Date());

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

  // ── Shop detail rows (5 rows max) — matches RecoveryReceipt exactly ──
  type ShopRow = {
    icon: React.ComponentProps<typeof MaterialIcons>['name'];
    label: string;
    value: string;
    bold?: boolean;
  };
  const shopRows: ShopRow[] = [
    { icon: 'store', label: 'Shop', value: payload.shopName, bold: true },
    ...(payload.shopAddress ? [{ icon: 'location-on' as const, label: 'Address', value: payload.shopAddress }] : []),
    ...(payload.shopOwnerName ? [{ icon: 'person' as const, label: 'Owner', value: payload.shopOwnerName }] : []),
    ...(payload.shopPhone ? [{ icon: 'call' as const, label: 'Phone', value: payload.shopPhone }] : []),
    { icon: 'calendar-today', label: 'Date', value: `${today}, ${timeNow}` },
  ];

  return (
    <Modal visible={visible} transparent animationType="none">
      <Pressable style={styles.backdrop} disabled={sending}>
        <Animated.View style={[styles.backdropFade, { opacity }]} />
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.center}
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
          {/* Close button (top-right X) */}
          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
            onPress={handleClose}
            disabled={sending}
            hitSlop={12}
          >
            <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>

          {/* ════════════════════════════════════════════════════════ */}
          {/* RECEIPT CARD — White, captured as image (receiptRef)     */}
          {/* Design matches RecoveryReceipt.tsx EXACTLY               */}
          {/* ════════════════════════════════════════════════════════ */}
          <View ref={receiptRef} collapsable={false} style={styles.receipt}>
            {/* ────────────────────────────────────────────────────── */}
            {/* 1. BLUE GRADIENT HEADER  (#1E40AF → #3B82F6)          */}
            {/* ────────────────────────────────────────────────────── */}
            <View style={styles.receiptHead}>
              <View style={styles.receiptHeadOverlay} />

              {/* Receipt number top-right */}
              <View style={styles.receiptNoWrap}>
                <Text style={styles.receiptNoText}>#{receiptNumber}</Text>
              </View>

              {/* Landmark / building icon (centered) */}
              <View style={styles.receiptBuildingIcon}>
                <MaterialIcons name="account-balance" size={22} color="#FFFFFF" />
              </View>

              {/* Business name (large, bold, white) */}
              <Text style={styles.receiptBusinessName}>
                {(businessName || 'AL-FALAH TRADERS').toUpperCase()}
              </Text>

              {/* Company name subtitle (semi-transparent) */}
              {payload.companyName ? (
                <Text style={styles.receiptCompanySub}>{payload.companyName}</Text>
              ) : null}

              {/* "PAYMENT RECEIPT" white pill badge */}
              <View style={styles.receiptPayPill}>
                <Text style={styles.receiptPayPillText}>PAYMENT RECEIPT</Text>
              </View>
            </View>

            {/* ────────────────────────────────────────────────────── */}
            {/* 2. DISTRIBUTOR PHONE STRIP  (light blue #DBEAFE)      */}
            {/* ────────────────────────────────────────────────────── */}
            {payload.distributorPhone ? (
              <View style={styles.receiptDistStrip}>
                <View style={styles.receiptDistIconWrap}>
                  <MaterialIcons name="call" size={12} color="#4338CA" />
                </View>
                <Text style={styles.receiptDistLab}>Distributor No:</Text>
                <Text style={styles.receiptDistVal}>{payload.distributorPhone}</Text>
              </View>
            ) : null}

            {/* ────────────────────────────────────────────────────── */}
            {/* 3. DASHED DIVIDER                                     */}
            {/* ────────────────────────────────────────────────────── */}
            <View style={styles.receiptDashedDivider} />

            {/* ────────────────────────────────────────────────────── */}
            {/* 4. SHOP DETAILS SECTION  (white, 5 rows)              */}
            {/* ────────────────────────────────────────────────────── */}
            <View style={styles.receiptShopSection}>
              {shopRows.map((row, idx) => (
                <View key={`${row.label}-${idx}`} style={styles.receiptRow}>
                  <View style={styles.receiptRowIcon}>
                    <MaterialIcons name={row.icon} size={13} color="#64748B" />
                  </View>
                  <Text style={styles.receiptRowLab}>{row.label}:</Text>
                  <Text
                    style={row.bold ? styles.receiptRowValBold : styles.receiptRowVal}
                    numberOfLines={row.bold ? 1 : 2}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>

            {/* ────────────────────────────────────────────────────── */}
            {/* 5. ORDERBOOKER STRIP  (gray bg)                       */}
            {/* ────────────────────────────────────────────────────── */}
            {payload.orderbookerName ? (
              <View style={styles.receiptObStrip}>
                <View style={styles.receiptObIcon}>
                  <MaterialIcons name="badge" size={13} color="#4F46E5" />
                </View>
                <Text style={styles.receiptObLab}>Orderbooker:</Text>
                <Text style={styles.receiptObVal}>{payload.orderbookerName}</Text>
              </View>
            ) : null}

            {/* ────────────────────────────────────────────────────── */}
            {/* 6. AMOUNT DETAILS BOX  (highlighted, border/tint)     */}
            {/* ────────────────────────────────────────────────────── */}
            <View style={styles.receiptAmounts}>
              {/* Opening Balance row */}
              <View style={styles.receiptAmtRow}>
                <Text style={styles.receiptAmtLab}>Opening Balance</Text>
                <Text style={styles.receiptAmtVal}>{formatPKR(payload.openingBalance)}</Text>
              </View>

              <View style={styles.receiptAmtDiv} />

              {/* Payment Received row (GREEN, with down-arrow) */}
              <View style={styles.receiptAmtRow}>
                <Text style={styles.receiptAmtLab}>Payment Received</Text>
                <View style={styles.receiptAmtGreenWrap}>
                  <View style={styles.receiptAmtArrow}>
                    <MaterialIcons name="arrow-downward" size={11} color="#16A34A" />
                  </View>
                  <Text style={styles.receiptAmtValGreen}>{formatPKR(payload.recoveryAmount)}</Text>
                </View>
              </View>

              <View style={styles.receiptAmtDivThick} />

              {/* Remaining Balance row (AMBER #D97706, BOLD, LARGE 19px) */}
              <View style={[styles.receiptAmtRow, styles.receiptAmtRowHighlight]}>
                <Text style={styles.receiptAmtLabHighlight}>Remaining Balance</Text>
                <Text style={styles.receiptAmtValHighlight}>
                  {formatPKR(payload.remainingBalance)}
                </Text>
              </View>
            </View>

            {/* ────────────────────────────────────────────────────── */}
            {/* 7. SUCCESS BADGE  (centered)                          */}
            {/* ────────────────────────────────────────────────────── */}
            <View style={styles.receiptSuccess}>
              <View style={styles.receiptCheckRing}>
                <View style={styles.receiptCheckCircle}>
                  <MaterialIcons name="check" size={26} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.receiptSuccessTitle}>Payment Successful</Text>
              <Text style={styles.receiptSuccessSub}>Thank you for your payment!</Text>
            </View>

            {/* ────────────────────────────────────────────────────── */}
            {/* 8. URDU HIDAYAT STRIP  (amber #FFFBEB, RTL)           */}
            {/* ────────────────────────────────────────────────────── */}
            <View style={styles.receiptUrdu}>
              <MaterialIcons name="info" size={14} color="#B45309" style={styles.receiptUrduIcon} />
              <Text style={styles.receiptUrduText}>
                اگر آپ کو کسی بھی قسم کا کوئی فرق محسوس ہوتا ہے بیلنس میں تو اوپر دیے گئے نمبر پر لازمی رابطہ کریں شکریہ
              </Text>
            </View>

            {/* ────────────────────────────────────────────────────── */}
            {/* 9. BLUE GRADIENT FOOTER                               */}
            {/* ────────────────────────────────────────────────────── */}
            <View style={styles.receiptFooter}>
              <View style={styles.receiptFooterOverlay} />
              <Text style={styles.receiptFooterMain}>Powered by Finexa Credit System</Text>
              <Text style={styles.receiptFooterSub}>www.finexa.app · v2.4.1</Text>
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

          {/* WhatsApp Button (green #25D366) */}
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

          {/* Close button (outline) */}
          <Pressable
            style={({ pressed }) => [styles.closeOutlineBtn, pressed && { opacity: 0.82 }]}
            onPress={handleClose}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <MaterialIcons name="close" size={15} color="#475569" />
            <Text style={styles.closeOutlineBtnText}>Close</Text>
          </Pressable>

          {/* Gallery hint */}
          <View style={styles.galleryHint}>
            <MaterialIcons name="photo-library" size={14} color={Colors.textSecondary} />
            <Text style={styles.galleryHintText}>
              Receipt image gallery mein save ho gayi hai — WhatsApp mein attach karein
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

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

// ═══════════════════════════════════════════════════════════
// Modern Blue Theme Colors (matches RecoveryReceipt.tsx)
// ═══════════════════════════════════════════════════════════
const C = {
  blue900: '#4338CA',
  blue800: '#4338CA',
  blue700: '#4F46E5',
  blue600: '#6366F1',
  blue500: '#818CF8',
  blue100: '#E0E7FF',
  blue50: '#EFF6FF',
  green600: '#16A34A',
  green500: '#22C55E',
  green100: '#DCFCE7',
  amber500: '#F59E0B',
  amber600: '#D97706',
  amber800: '#B45309',
  amber900: '#92400E',
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
  waGreen: '#25D366',
  overlay: 'rgba(15, 23, 42, 0.85)',
};

const styles = StyleSheet.create({
  // ===== BACKDROP (dark overlay) =====
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backdropFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.overlay,
  },

  // ===== CENTER / SCROLL =====
  center: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    zIndex: 1,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    position: 'relative',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    ...Shadow.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },

  // Close button (top-right X)
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

  // ═══════════════════════════════════════════
  // RECEIPT CARD (white, captured as image)
  // — matches RecoveryReceipt.tsx EXACTLY
  // ═══════════════════════════════════════════
  receipt: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: C.white,
    ...Shadow.xl,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.5,
    shadowRadius: 50,
    elevation: 24,
    marginTop: 36,
    marginBottom: Spacing.sm,
  },

  // ── 1. Blue Gradient Header ──
  receiptHead: {
    backgroundColor: C.blue900,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  receiptHeadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.blue600,
    opacity: 0.35,
  },
  receiptNoWrap: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 2,
  },
  receiptNoText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  receiptBuildingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    zIndex: 1,
  },
  receiptBusinessName: {
    fontSize: 14,
    fontWeight: FontWeight.extrabold,
    color: C.white,
    letterSpacing: 1,
    textAlign: 'center',
    zIndex: 1,
  },
  receiptCompanySub: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    fontWeight: FontWeight.medium,
    zIndex: 1,
  },
  receiptPayPill: {
    marginTop: 9,
    backgroundColor: C.white,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 13,
    zIndex: 1,
  },
  receiptPayPillText: {
    fontSize: 9.5,
    fontWeight: FontWeight.bold,
    color: C.blue800,
    letterSpacing: 1.4,
  },

  // ── 2. Distributor Phone Strip ──
  receiptDistStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.blue100,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
  },
  receiptDistIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptDistLab: {
    fontSize: 11,
    color: C.blue800,
    fontWeight: FontWeight.semibold,
    opacity: 0.85,
  },
  receiptDistVal: {
    fontSize: 11.5,
    color: C.blue800,
    fontWeight: FontWeight.bold,
    marginLeft: 'auto',
    letterSpacing: 0.2,
  },

  // ── 3. Dashed Divider ──
  receiptDashedDivider: {
    height: 1,
    marginHorizontal: 14,
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.gray300,
    borderStyle: 'dashed',
  },

  // ── 4. Shop Details ──
  receiptShopSection: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 5,
  },
  receiptRowIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: C.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptRowLab: {
    fontSize: 11,
    color: C.gray500,
    fontWeight: FontWeight.medium,
    minWidth: 62,
  },
  receiptRowVal: {
    flex: 1,
    fontSize: 11.5,
    color: C.gray900,
    fontWeight: FontWeight.semibold,
    textAlign: 'right',
  },
  receiptRowValBold: {
    flex: 1,
    fontSize: 13,
    color: C.gray900,
    fontWeight: FontWeight.bold,
    textAlign: 'right',
  },

  // ── 5. Orderbooker Strip ──
  receiptObStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: C.gray50,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: C.gray200,
    borderBottomWidth: 1,
    borderBottomColor: C.gray200,
  },
  receiptObIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: C.blue100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptObLab: {
    fontSize: 12,
    color: C.gray500,
    fontWeight: FontWeight.medium,
  },
  receiptObVal: {
    fontSize: 12.5,
    color: C.gray900,
    fontWeight: FontWeight.bold,
    marginLeft: 'auto',
  },

  // ── 6. Amount Details Box ──
  receiptAmounts: {
    marginHorizontal: 14,
    marginVertical: 10,
    backgroundColor: C.blue50,
    borderWidth: 1,
    borderColor: C.blue100,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  receiptAmtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  receiptAmtLab: {
    fontSize: 11.5,
    color: C.gray600,
    fontWeight: FontWeight.medium,
  },
  receiptAmtVal: {
    fontSize: 13,
    color: C.gray900,
    fontWeight: FontWeight.bold,
  },
  // Green received amount with down-arrow icon
  receiptAmtGreenWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  receiptAmtArrow: {
    width: 18,
    height: 18,
    borderRadius: 6,
    backgroundColor: C.green100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptAmtValGreen: {
    fontSize: 13,
    color: C.green600,
    fontWeight: FontWeight.bold,
  },
  receiptAmtDiv: {
    height: 1,
    backgroundColor: C.blue100,
  },
  receiptAmtDivThick: {
    height: 2,
    backgroundColor: C.blue100,
    marginVertical: 1,
  },
  receiptAmtRowHighlight: {
    paddingVertical: 10,
  },
  receiptAmtLabHighlight: {
    fontSize: 12.5,
    color: C.gray900,
    fontWeight: FontWeight.bold,
  },
  receiptAmtValHighlight: {
    fontSize: 19,
    color: C.amber600,
    fontWeight: FontWeight.extrabold,
    letterSpacing: -0.2,
  },

  // ── 7. Success Badge ──
  receiptSuccess: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  receiptCheckRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: C.green500,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  receiptCheckCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptSuccessTitle: {
    fontSize: 14,
    fontWeight: FontWeight.bold,
    color: C.green600,
  },
  receiptSuccessSub: {
    fontSize: 11,
    color: C.gray500,
    marginTop: 3,
    fontWeight: FontWeight.medium,
  },

  // ── 8. Urdu Hidayat ──
  receiptUrdu: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: C.amber50,
    borderTopWidth: 1,
    borderTopColor: C.amber100,
    borderBottomWidth: 1,
    borderBottomColor: C.amber100,
    borderStyle: 'dashed',
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  receiptUrduIcon: {
    marginTop: 3,
  },
  receiptUrduText: {
    flex: 1,
    fontSize: 11,
    color: C.amber900,
    lineHeight: 22,
    fontWeight: FontWeight.medium,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  // ── 9. Blue Gradient Footer ──
  receiptFooter: {
    backgroundColor: C.blue900,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  receiptFooterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.blue600,
    opacity: 0.35,
  },
  receiptFooterMain: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    color: C.white,
    letterSpacing: 0.3,
    zIndex: 1,
  },
  receiptFooterSub: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
    fontWeight: FontWeight.medium,
    letterSpacing: 0.2,
    zIndex: 1,
  },

  // ═══════════════════════════════════════════
  // MANDATORY NOTE + ACTION BUTTONS (below receipt, not captured)
  // ═══════════════════════════════════════════

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
    backgroundColor: '#4F46E5',
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

  // Close outline button (gray outline, matches RecoveryReceipt closeBtn)
  closeOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'rgba(148, 163, 184, 0.10)',
    borderWidth: 1.5,
    borderColor: C.gray400,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: Spacing.sm,
  },
  closeOutlineBtnText: {
    fontSize: 12.5,
    fontWeight: FontWeight.semibold,
    color: C.gray600,
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
