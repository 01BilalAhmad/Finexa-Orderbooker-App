// Powered by Finexa
// Recovery Receipt — Modern Blue design matching Screen 11 mockup.
// White receipt card with blue gradient header/footer, success badge, Urdu hidayat.
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
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Linking from 'expo-linking';
import * as MediaLibrary from 'expo-media-library';
import { formatPKR } from '@/utils/format';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { ApiService } from '@/services/api';
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

  // Receipt number for display (derived from current timestamp)
  const _now = new Date();
  const receiptNumber = `RC-${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}${String(_now.getDate()).padStart(2, '0')}-${String(_now.getHours()).padStart(2, '0')}${String(_now.getMinutes()).padStart(2, '0')}`;

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

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
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
          {/* ── Modal Topbar ── */}
          <View style={styles.topbar}>
            <View style={styles.topbarTitle}>
              <MaterialIcons name="receipt" size={18} color="#93C5FD" />
              <Text style={styles.topbarTitleText}>Recovery Receipt</Text>
            </View>
            <Pressable style={styles.topbarClose} onPress={onClose} hitSlop={10}>
              <MaterialIcons name="close" size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* ════════════════════════════════════════════ */}
          {/* RECEIPT CARD — White, captured as image       */}
          {/* ════════════════════════════════════════════ */}
          <View ref={receiptRef} collapsable={false} style={styles.receipt}>
            {/* ── 1. Blue Gradient Header ── */}
            <View style={styles.receiptHead}>
              <View style={styles.receiptHeadOverlay} />
              <View style={styles.receiptNoWrap}>
                <Text style={styles.receiptNoText}>#{receiptNumber}</Text>
              </View>
              <View style={styles.receiptBuildingIcon}>
                <MaterialIcons name="account-balance" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.receiptBusinessName}>
                {(businessName || 'AL-FALAH TRADERS').toUpperCase()}
              </Text>
              {companyName ? (
                <Text style={styles.receiptCompanySub}>{companyName}</Text>
              ) : null}
              <View style={styles.receiptPayPill}>
                <Text style={styles.receiptPayPillText}>PAYMENT RECEIPT</Text>
              </View>
            </View>

            {/* ── 2. Distributor Phone Strip ── */}
            {distributorPhone ? (
              <View style={styles.receiptDistStrip}>
                <MaterialIcons name="call" size={12} color="#2563EB" />
                <Text style={styles.receiptDistLab}>Distributor No:</Text>
                <Text style={styles.receiptDistVal}>{distributorPhone}</Text>
              </View>
            ) : null}

            {/* ── 3. Dashed Divider ── */}
            <View style={styles.receiptDashedDivider} />

            {/* ── 4. Shop Details ── */}
            <View style={styles.receiptShopSection}>
              <View style={styles.receiptRow}>
                <View style={styles.receiptRowIcon}>
                  <MaterialIcons name="store" size={13} color="#64748B" />
                </View>
                <Text style={styles.receiptRowLab}>Shop:</Text>
                <Text style={styles.receiptRowValBold}>{shopName}</Text>
              </View>
              {shopAddress ? (
                <View style={styles.receiptRow}>
                  <View style={styles.receiptRowIcon}>
                    <MaterialIcons name="location-on" size={13} color="#64748B" />
                  </View>
                  <Text style={styles.receiptRowLab}>Address:</Text>
                  <Text style={styles.receiptRowVal}>{shopAddress}</Text>
                </View>
              ) : null}
              {shopOwnerName ? (
                <View style={styles.receiptRow}>
                  <View style={styles.receiptRowIcon}>
                    <MaterialIcons name="person" size={13} color="#64748B" />
                  </View>
                  <Text style={styles.receiptRowLab}>Owner:</Text>
                  <Text style={styles.receiptRowVal}>{shopOwnerName}</Text>
                </View>
              ) : null}
              {shopPhone ? (
                <View style={styles.receiptRow}>
                  <View style={styles.receiptRowIcon}>
                    <MaterialIcons name="call" size={13} color="#64748B" />
                  </View>
                  <Text style={styles.receiptRowLab}>Phone:</Text>
                  <Text style={styles.receiptRowVal}>{shopPhone}</Text>
                </View>
              ) : null}
              <View style={styles.receiptRow}>
                <View style={styles.receiptRowIcon}>
                  <MaterialIcons name="calendar-today" size={13} color="#64748B" />
                </View>
                <Text style={styles.receiptRowLab}>Date:</Text>
                <Text style={styles.receiptRowVal}>{today}, {timeNow}</Text>
              </View>
            </View>

            {/* ── 5. Orderbooker Strip ── */}
            {orderbookerName ? (
              <View style={styles.receiptObStrip}>
                <View style={styles.receiptObIcon}>
                  <MaterialIcons name="badge" size={13} color="#2563EB" />
                </View>
                <Text style={styles.receiptObLab}>Orderbooker:</Text>
                <Text style={styles.receiptObVal}>{orderbookerName}</Text>
              </View>
            ) : null}

            {/* ── 6. Amount Details Box ── */}
            <View style={styles.receiptAmounts}>
              <View style={styles.receiptAmtRow}>
                <Text style={styles.receiptAmtLab}>Opening Balance</Text>
                <Text style={styles.receiptAmtVal}>{formatPKR(openingBalance)}</Text>
              </View>
              <View style={styles.receiptAmtDiv} />
              <View style={styles.receiptAmtRow}>
                <Text style={styles.receiptAmtLab}>Payment Received</Text>
                <Text style={styles.receiptAmtValGreen}>{formatPKR(recoveryAmount)}</Text>
              </View>
              <View style={styles.receiptAmtDivThick} />
              <View style={[styles.receiptAmtRow, styles.receiptAmtRowHighlight]}>
                <Text style={styles.receiptAmtLabHighlight}>Remaining Balance</Text>
                <Text style={styles.receiptAmtValHighlight}>{formatPKR(remainingBalance)}</Text>
              </View>
            </View>

            {/* ── 7. Success Badge ── */}
            <View style={styles.receiptSuccess}>
              <View style={styles.receiptCheckRing}>
                <View style={styles.receiptCheckCircle}>
                  <MaterialIcons name="check" size={26} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.receiptSuccessTitle}>Payment Successful</Text>
              <Text style={styles.receiptSuccessSub}>Thank you for your payment!</Text>
            </View>

            {/* ── 8. Urdu Hidayat ── */}
            <View style={styles.receiptUrdu}>
              <MaterialIcons name="info" size={14} color="#B45309" style={styles.receiptUrduIcon} />
              <Text style={styles.receiptUrduText}>
                اگر آپ کو کسی بھی قسم کا کوئی فرق محسوس ہوتا ہے بیلنس میں تو اوپر دیے گئے نمبر پر لازمی رابطہ کریں شکریہ
              </Text>
            </View>

            {/* ── 9. Blue Gradient Footer ── */}
            <View style={styles.receiptFooter}>
              <View style={styles.receiptFooterOverlay} />
              <Text style={styles.receiptFooterMain}>Powered by Finexa Credit System</Text>
              <Text style={styles.receiptFooterSub}>www.finexa.app · v2.4.1</Text>
            </View>
          </View>

          {/* ════════════════════════════════════════════ */}
          {/* ACTION BUTTONS (not captured)                  */}
          {/* ════════════════════════════════════════════ */}
          <View style={styles.actionsContainer}>
            {/* Share on WhatsApp — full width green */}
            <Pressable
              style={({ pressed }) => [styles.waBtn, pressed && { opacity: 0.88 }]}
              onPress={handleShareImage}
              disabled={isCapturing}
            >
              <MaterialIcons name="chat" size={17} color="#FFFFFF" />
              <Text style={styles.waBtnText}>Share on WhatsApp</Text>
            </Pressable>

            {/* Save Image + Close — side by side */}
            <View style={styles.actionsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.saveBtn,
                  isCapturing && styles.saveBtnDisabled,
                  pressed && !isCapturing && { opacity: 0.85 },
                ]}
                onPress={savedImageUri ? handleResend : handleShareImage}
                disabled={isCapturing}
              >
                {isCapturing ? (
                  <ActivityIndicator size="small" color="#93C5FD" />
                ) : (
                  <MaterialIcons name={savedImageUri ? 'save' : 'download'} size={15} color="#93C5FD" />
                )}
                <Text style={styles.saveBtnText}>
                  {isCapturing ? 'Saving...' : savedImageUri ? 'Save Again' : 'Save Image'}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.85 }]}
                onPress={onClose}
              >
                <MaterialIcons name="close" size={14} color="rgba(255,255,255,0.85)" />
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
  // ===== BACKDROP =====
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

  // ===== MODAL TOPBAR =====
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 10,
    marginBottom: 6,
  },
  topbarTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    // Strong shadow for the paper effect
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.5,
    shadowRadius: 50,
    elevation: 24,
  },

  // ── 1. Blue Gradient Header ──
  receiptHead: {
    backgroundColor: C.blue900,
    paddingTop: 16,
    paddingBottom: 16,
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
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    zIndex: 2,
  },
  receiptNoText: {
    fontSize: 9.5,
    fontWeight: FontWeight.semibold,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.2,
  },
  receiptBuildingIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    zIndex: 1,
  },
  receiptBusinessName: {
    fontSize: 13,
    fontWeight: FontWeight.extrabold,
    color: C.white,
    letterSpacing: 0.9,
    textAlign: 'center',
    zIndex: 1,
  },
  receiptCompanySub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    fontWeight: FontWeight.medium,
    zIndex: 1,
  },
  receiptPayPill: {
    marginTop: 8,
    backgroundColor: C.white,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
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
    gap: 6,
    backgroundColor: C.blue50,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.blue100,
  },
  receiptDistLab: {
    fontSize: 11,
    color: C.blue800,
    fontWeight: FontWeight.semibold,
    opacity: 0.85,
  },
  receiptDistVal: {
    fontSize: 11,
    color: C.blue800,
    fontWeight: FontWeight.bold,
    marginLeft: 'auto',
    letterSpacing: 0.2,
  },

  // ── 3. Dashed Divider ──
  receiptDashedDivider: {
    height: 1,
    marginHorizontal: 14,
    marginTop: 8,
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
    minWidth: 60,
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
    paddingVertical: 8,
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
    paddingVertical: 9,
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
    paddingVertical: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  receiptCheckRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: C.green500,
    opacity: 0.99,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
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
    paddingVertical: 8,
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
    paddingVertical: 10,
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
    marginTop: 10,
    paddingHorizontal: 2,
    paddingBottom: 16,
  },

  // WhatsApp button — full width green
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: C.waGreen,
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 8,
    ...Shadow.md,
    shadowColor: C.waGreen,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
  waBtnText: {
    fontSize: 13,
    fontWeight: FontWeight.bold,
    color: C.white,
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
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: C.blue500,
    borderRadius: 12,
    paddingVertical: 11,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 12.5,
    fontWeight: FontWeight.semibold,
    color: C.blue500,
  },
  // Close button — white outline
  closeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 12,
    paddingVertical: 11,
  },
  closeBtnText: {
    fontSize: 12.5,
    fontWeight: FontWeight.semibold,
    color: 'rgba(255,255,255,0.85)',
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
