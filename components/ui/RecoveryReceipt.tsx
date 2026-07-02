// Powered by Finexa
// Recovery Receipt — Modern Blue design (Screen 11 mockup).
// White receipt card with blue gradient header/footer, distributor strip,
// shop details, amount details box, success badge, Urdu hidayat.
// Dark overlay background with modal topbar. All functionality preserved.
import React, { useRef, useState, useEffect } from 'react';
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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Linking from 'expo-linking';
import * as MediaLibrary from 'expo-media-library';
import { formatPKR } from '@/utils/format';
import { Spacing, FontWeight, Shadow } from '@/constants/theme';
import { StorageService } from '@/services/storage';
import { getApiUrl } from '@/constants/config';

interface RecoveryReceiptProps {
  visible: boolean;
  shopName: string;
  shopAddress?: string;
  shopOwnerName?: string;
  shopPhone: string;
  openingBalance: number;
  recoveryAmount: number;
  remainingBalance: number;
  companyName?: string;
  orderbookerName?: string;
  distributorPhone?: string;
  onClose: () => void;
}

/** Format phone number to international format (923001234567) */
function formatPhoneIntl(phone: string): string {
  let p = phone.trim().replace(/[^0-9]/g, '');
  if (p.startsWith('+')) p = p.substring(1);
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

export function RecoveryReceipt({
  visible,
  shopName,
  shopAddress,
  shopOwnerName,
  shopPhone,
  openingBalance,
  recoveryAmount,
  remainingBalance,
  companyName,
  orderbookerName,
  distributorPhone,
  onClose,
}: RecoveryReceiptProps) {
  const receiptRef = useRef<View>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [savedImageUri, setSavedImageUri] = useState<string | null>(null);
  const [imageSavedToGallery, setImageSavedToGallery] = useState(false);
  const [businessName, setBusinessName] = useState<string>('');
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // ── Fetch business name from CMS (admin set name) ──
  // Falls back to AsyncStorage cached value, then to 'AL-FALAH TRADERS'
  useEffect(() => {
    (async () => {
      // 1. Try cached value first (for instant display + offline)
      const cached = await StorageService.getBusinessName();
      if (cached) {
        setBusinessName(cached);
      }

      // 2. Try fetching fresh from API (in background)
      try {
        const apiUrl = getApiUrl(); // synchronous — returns cached URL or DEFAULT_URL
        const res = await fetch(`${apiUrl}/api/config`);
        if (res.ok) {
          const data = await res.json();
          const name = data.config?.businessName || 'AL-FALAH TRADERS';
          setBusinessName(name);
          await StorageService.saveBusinessName(name);
        }
      } catch {
        // Offline — use cached value (already set above)
        if (!cached) {
          setBusinessName('AL-FALAH TRADERS');
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (visible) {
      setIsCapturing(false);
      setSavedImageUri(null);
      setImageSavedToGallery(false);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.9);
      opacity.setValue(0);
    }
  }, [visible]);

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

  /**
   * Capture receipt as image and save to gallery.
   * Returns the gallery URI if successful.
   */
  const captureAndSaveToGallery = async (): Promise<string | null> => {
    if (!receiptRef.current) return null;

    // Wait for UI to fully render
    await new Promise(r => setTimeout(r, 800));

    // Step 1: Capture receipt as image
    let imageUri: string;
    try {
      imageUri = await captureRef(receiptRef, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
      });
    } catch (captureErr) {
      console.error('[RecoveryReceipt] captureRef failed:', captureErr);
      throw new Error('Failed to capture receipt image');
    }

    if (!imageUri) {
      throw new Error('Image capture returned empty URI');
    }

    console.log('[RecoveryReceipt] Image captured at:', imageUri);

    // Ensure URI has file:// prefix for MediaLibrary
    const normalizedUri = imageUri.startsWith('file://') ? imageUri : `file://${imageUri}`;

    // Step 2: Save image to device Gallery
    let savedAssetUri: string | null = null;
    try {
      // Request permissions — try with full access first, fallback to writeOnly
      let permResult = await MediaLibrary.requestPermissionsAsync(false);
      console.log('[RecoveryReceipt] MediaLibrary permission status (full):', permResult.status);

      if (permResult.status !== 'granted') {
        permResult = await MediaLibrary.requestPermissionsAsync(true);
        console.log('[RecoveryReceipt] MediaLibrary permission status (writeOnly):', permResult.status);
      }

      if (permResult.status === 'granted') {
        const asset = await MediaLibrary.createAssetAsync(normalizedUri);
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
        savedAssetUri = asset.uri;
        setImageSavedToGallery(true);
        console.log('[RecoveryReceipt] Image saved to gallery:', asset.uri);
      } else if ((permResult.status as string) === 'limited') {
        try {
          const asset = await MediaLibrary.createAssetAsync(normalizedUri);
          savedAssetUri = asset.uri;
          setImageSavedToGallery(true);
        } catch (limitedErr) {
          console.warn('[RecoveryReceipt] Could not save even with limited access:', limitedErr);
        }
      } else {
        console.warn('[RecoveryReceipt] MediaLibrary permission denied');
        Alert.alert(
          'Gallery Permission Needed',
          'Please allow gallery access to save receipt images. You can still send via WhatsApp.',
          [{ text: 'OK' }]
        );
      }
    } catch (galleryErr: any) {
      console.warn('[RecoveryReceipt] Could not save to gallery:', galleryErr?.message || galleryErr);
    }

    return savedAssetUri || imageUri;
  };

  /**
   * First-time send: capture image, save to gallery, open WhatsApp
   */
  const handleShareImage = async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    try {
      const uri = await captureAndSaveToGallery();
      if (uri) {
        setSavedImageUri(uri);
      }

      if (shopPhone) {
        const phone = formatPhoneIntl(shopPhone);
        const whatsappUrl = `https://wa.me/${phone}`;
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (canOpen) {
          await Linking.openURL(whatsappUrl);

          if (imageSavedToGallery) {
            Alert.alert(
              'Receipt Ready!',
              `Receipt saved in Gallery (Finexa Receipts)!\n\nWhatsApp chat opened for ${shopName}.\n\nTap attachment → Gallery → Select receipt → Send`,
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert(
              'Receipt Ready',
              `WhatsApp chat opened for ${shopName}.\n\nAttach the receipt image from your Gallery to send it.`,
              [{ text: 'OK' }]
            );
          }
        } else {
          Alert.alert('WhatsApp Not Available', 'Please install WhatsApp to send receipt.');
        }
      } else {
        Alert.alert('No Phone Number', 'This shop has no phone number for WhatsApp.');
      }
    } catch (error: any) {
      console.error('[RecoveryReceipt] Share failed:', error);
      if (shopPhone) {
        const phone = formatPhoneIntl(shopPhone);
        Alert.alert(
          'Image Error',
          'Receipt image save nahi hua. WhatsApp chat kholen?',
          [
            { text: 'WhatsApp Kholo', onPress: () => Linking.openURL(`https://wa.me/${phone}`) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    } finally {
      setIsCapturing(false);
    }
  };

  /**
   * Re-send: recapture receipt image, save to gallery, open WhatsApp
   */
  const handleResend = async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    try {
      const uri = await captureAndSaveToGallery();
      if (uri) {
        setSavedImageUri(uri);
      }

      if (shopPhone) {
        const phone = formatPhoneIntl(shopPhone);
        const whatsappUrl = `https://wa.me/${phone}`;
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (canOpen) {
          await Linking.openURL(whatsappUrl);
          Alert.alert(
            'Receipt Re-saved!',
            `New receipt image saved in Gallery (Finexa Receipts)!\n\nWhatsApp chat opened for ${shopName}.\n\nTap attachment → Gallery → Select latest receipt → Send`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('WhatsApp Not Available', 'Please install WhatsApp.');
        }
      } else {
        Alert.alert('No Phone Number', 'This shop has no phone number for WhatsApp.');
      }
    } catch (error: any) {
      console.error('[RecoveryReceipt] Resend failed:', error);
      if (shopPhone) {
        const phone = formatPhoneIntl(shopPhone);
        Alert.alert(
          'Image Error',
          'Receipt image dobara save nahi hua. WhatsApp chat kholen?',
          [
            { text: 'WhatsApp Kholo', onPress: () => Linking.openURL(`https://wa.me/${phone}`) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    } finally {
      setIsCapturing(false);
    }
  };

  if (!visible) return null;

  // ── Shop detail rows (5 rows max) ──
  type ShopRow = {
    icon: React.ComponentProps<typeof MaterialIcons>['name'];
    label: string;
    value: string;
    bold?: boolean;
  };
  const shopRows: ShopRow[] = [
    { icon: 'store', label: 'Shop', value: shopName, bold: true },
    ...(shopAddress ? [{ icon: 'location-on' as const, label: 'Address', value: shopAddress }] : []),
    ...(shopOwnerName ? [{ icon: 'person' as const, label: 'Owner', value: shopOwnerName }] : []),
    ...(shopPhone ? [{ icon: 'call' as const, label: 'Phone', value: shopPhone }] : []),
    { icon: 'calendar-today', label: 'Date', value: `${today}, ${timeNow}` },
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* ── Dark Overlay (rgba(15, 23, 42, 0.85)) ── */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.backdropFade, { opacity }]} />
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.center}
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.cardWrap, { transform: [{ scale }], opacity }]}>
          {/* ════════════════════════════════════════════════════════ */}
          {/* MODAL TOPBAR  (NOT captured)                              */}
          {/* ════════════════════════════════════════════════════════ */}
          <View style={styles.topbar}>
            <View style={styles.topbarTitle}>
              <View style={styles.topbarTitleIcon}>
                <MaterialIcons name="receipt-long" size={15} color="#FFFFFF" />
              </View>
              <Text style={styles.topbarTitleText}>Recovery Receipt</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.topbarClose, pressed && { opacity: 0.7 }]}
              onPress={onClose}
              hitSlop={12}
              accessibilityLabel="Close receipt"
            >
              <MaterialIcons name="close" size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* ════════════════════════════════════════════════════════ */}
          {/* RECEIPT CARD  — White, captured as image (receiptRef)    */}
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
              {companyName ? (
                <Text style={styles.receiptCompanySub}>{companyName}</Text>
              ) : null}

              {/* "PAYMENT RECEIPT" white pill badge */}
              <View style={styles.receiptPayPill}>
                <Text style={styles.receiptPayPillText}>PAYMENT RECEIPT</Text>
              </View>
            </View>

            {/* ────────────────────────────────────────────────────── */}
            {/* 2. DISTRIBUTOR PHONE STRIP  (light blue #DBEAFE)      */}
            {/* ────────────────────────────────────────────────────── */}
            {distributorPhone ? (
              <View style={styles.receiptDistStrip}>
                <View style={styles.receiptDistIconWrap}>
                  <MaterialIcons name="call" size={12} color="#1E40AF" />
                </View>
                <Text style={styles.receiptDistLab}>Distributor No:</Text>
                <Text style={styles.receiptDistVal}>{distributorPhone}</Text>
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
            {orderbookerName ? (
              <View style={styles.receiptObStrip}>
                <View style={styles.receiptObIcon}>
                  <MaterialIcons name="badge" size={13} color="#2563EB" />
                </View>
                <Text style={styles.receiptObLab}>Orderbooker:</Text>
                <Text style={styles.receiptObVal}>{orderbookerName}</Text>
              </View>
            ) : null}

            {/* ────────────────────────────────────────────────────── */}
            {/* 6. AMOUNT DETAILS BOX  (highlighted, border/tint)     */}
            {/* ────────────────────────────────────────────────────── */}
            <View style={styles.receiptAmounts}>
              {/* Opening Balance row */}
              <View style={styles.receiptAmtRow}>
                <Text style={styles.receiptAmtLab}>Opening Balance</Text>
                <Text style={styles.receiptAmtVal}>{formatPKR(openingBalance)}</Text>
              </View>

              <View style={styles.receiptAmtDiv} />

              {/* Payment Received row (GREEN, with down-arrow) */}
              <View style={styles.receiptAmtRow}>
                <Text style={styles.receiptAmtLab}>Payment Received</Text>
                <View style={styles.receiptAmtGreenWrap}>
                  <View style={styles.receiptAmtArrow}>
                    <MaterialIcons name="arrow-downward" size={11} color="#16A34A" />
                  </View>
                  <Text style={styles.receiptAmtValGreen}>{formatPKR(recoveryAmount)}</Text>
                </View>
              </View>

              <View style={styles.receiptAmtDivThick} />

              {/* Remaining Balance row (AMBER #D97706, BOLD, LARGE 19px) */}
              <View style={[styles.receiptAmtRow, styles.receiptAmtRowHighlight]}>
                <Text style={styles.receiptAmtLabHighlight}>Remaining Balance</Text>
                <Text style={styles.receiptAmtValHighlight}>
                  {formatPKR(remainingBalance)}
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

          {/* ════════════════════════════════════════════════════════ */}
          {/* ACTION BUTTONS  (below card, NOT captured)               */}
          {/* ════════════════════════════════════════════════════════ */}
          <View style={styles.actionsContainer}>
            {/* Share on WhatsApp — full width green (prominent) */}
            <Pressable
              style={({ pressed }) => [styles.waBtn, pressed && { opacity: 0.88 }]}
              onPress={handleShareImage}
              disabled={isCapturing}
              accessibilityRole="button"
              accessibilityLabel="Share receipt on WhatsApp"
            >
              {isCapturing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialIcons name="chat" size={18} color="#FFFFFF" />
              )}
              <Text style={styles.waBtnText}>Share on WhatsApp</Text>
            </Pressable>

            {/* Save Image (blue outline) + Close (gray outline) — side by side */}
            <View style={styles.actionsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.saveBtn,
                  isCapturing && styles.saveBtnDisabled,
                  pressed && !isCapturing && { opacity: 0.82 },
                ]}
                onPress={savedImageUri ? handleResend : handleShareImage}
                disabled={isCapturing}
                accessibilityRole="button"
                accessibilityLabel="Save receipt image to gallery"
              >
                {isCapturing ? (
                  <ActivityIndicator size="small" color="#2563EB" />
                ) : (
                  <MaterialIcons name={savedImageUri ? 'save' : 'download'} size={16} color="#2563EB" />
                )}
                <Text style={styles.saveBtnText}>
                  {isCapturing ? 'Saving...' : savedImageUri ? 'Save Again' : 'Save Image'}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.82 }]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close receipt"
              >
                <MaterialIcons name="close" size={15} color="#475569" />
                <Text style={styles.closeBtnText}>Close</Text>
              </Pressable>
            </View>

            {/* Re-send link (subtle) */}
            {savedImageUri ? (
              <Pressable
                style={({ pressed }) => [styles.resendRow, pressed && { opacity: 0.7 }]}
                onPress={handleResend}
                disabled={isCapturing}
              >
                <MaterialIcons name="refresh" size={13} color="#94A3B8" />
                <Text style={styles.resendText}>Re-send Receipt</Text>
              </Pressable>
            ) : null}

            {/* Gallery saved indicator */}
            {imageSavedToGallery ? (
              <View style={styles.savedIndicator}>
                <MaterialIcons name="check-circle" size={13} color="#22C55E" />
                <Text style={styles.savedText}>Saved in Gallery (Finexa Receipts)</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>
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
  cardWrap: {
    width: '100%',
    maxWidth: 400,
    position: 'relative',
  },

  // ═══════════════════════════════════════════
  // MODAL TOPBAR  (NOT captured)
  // ═══════════════════════════════════════════
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 10,
    marginBottom: 8,
  },
  topbarTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  topbarTitleIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topbarTitleText: {
    fontSize: 15,
    fontWeight: FontWeight.bold,
    color: C.white,
    letterSpacing: -0.3,
  },
  topbarClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ═══════════════════════════════════════════
  // RECEIPT CARD (white, captured as image)
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
  // ACTION BUTTONS (below receipt, not captured)
  // ═══════════════════════════════════════════
  actionsContainer: {
    marginTop: 12,
    paddingHorizontal: 2,
    paddingBottom: 16,
  },

  // WhatsApp button — full width green (prominent)
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.waGreen,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
    ...Shadow.md,
    shadowColor: C.waGreen,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
  waBtnText: {
    fontSize: 14,
    fontWeight: FontWeight.bold,
    color: C.white,
    letterSpacing: 0.2,
  },

  // Save + Close row
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  // Save button — blue outline
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'rgba(37, 99, 235, 0.06)',
    borderWidth: 1.5,
    borderColor: C.blue700,
    borderRadius: 12,
    paddingVertical: 12,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 12.5,
    fontWeight: FontWeight.semibold,
    color: C.blue700,
  },
  // Close button — visible gray outline
  closeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'rgba(148, 163, 184, 0.10)',
    borderWidth: 1.5,
    borderColor: C.gray400,
    borderRadius: 12,
    paddingVertical: 12,
  },
  closeBtnText: {
    fontSize: 12.5,
    fontWeight: FontWeight.semibold,
    color: C.gray600,
  },

  // Resend row (subtle)
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 4,
  },
  resendText: {
    fontSize: 12,
    fontWeight: FontWeight.semibold,
    color: C.gray400,
  },

  // Gallery saved indicator
  savedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 4,
  },
  savedText: {
    fontSize: 11,
    color: C.green500,
    fontWeight: FontWeight.medium,
  },
});
