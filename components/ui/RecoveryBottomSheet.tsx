// Powered by Finexa
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
  Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { Shop } from '@/services/api';
import { getShopDisplayBalance } from '@/components/ui/ShopCard';
import { formatPKR } from '@/utils/format';
import { getDistanceMeters } from '@/utils/distance';
import { QUICK_AMOUNTS, MIN_RECOVERY, MAX_RECOVERY } from '@/constants/config';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface RecoveryBottomSheetProps {
  visible: boolean;
  shop: Shop | null;
  companyId?: string;
  onClose: () => void;
  onSubmit: (payload: {
    amount: number;
    description: string;
    gpsLat?: number;
    gpsLng?: number;
    gpsAddress?: string;
    markGpsVisit: boolean;
    outOfRange?: boolean;
  }) => Promise<void>;
  isSubmitting: boolean;
}

function getOsmStaticUrl(lat: number, lng: number): string {
  const zoom = 16;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=600x260&markers=${lat},${lng},red`;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Animated pulse dot used by the GPS-captured indicator
function GpsPulse({ active, color = '#10B981' }: { active: boolean; color?: string }) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const colorRgb = hexToRgba(color, 0.18);
  const colorRgbInner = hexToRgba(color, 0.4);

  React.useEffect(() => {
    if (!active) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.35, duration: 800, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [active]);

  return (
    <Animated.View style={[{ transform: [{ scale }] }]}>
      <View style={[pulseStyles.outer, { backgroundColor: colorRgb }]}>
        <View style={[pulseStyles.inner, { backgroundColor: colorRgbInner }]} />
      </View>
    </Animated.View>
  );
}

const pulseStyles = StyleSheet.create({
  outer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

// Confetti particles animation
function ConfettiOverlay({ visible }: { visible: boolean }) {
  const particles = useRef(
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * SCREEN_WIDTH,
      delay: Math.random() * 300,
      color: ['#2563EB', '#F59E0B', '#EF4444', '#10B981', '#7C3AED'][i % 5],
      size: 4 + Math.random() * 6,
      rotation: Math.random() * 360,
    }))
  ).current;

  if (!visible) return null;

  return (
    <View style={confettiStyles.container} pointerEvents="none">
      {particles.map((p) => (
        <Animated.View
          key={p.id}
          style={[
            confettiStyles.particle,
            {
              left: p.x,
              backgroundColor: p.color,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
            },
          ]}
        />
      ))}
    </View>
  );
}
const confettiStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 100,
  },
  particle: {
    position: 'absolute',
    top: -10,
  },
});

// Animated success checkmark
function SuccessCheckmark({ visible }: { visible: boolean }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[successStyles.container, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
      <LinearGradient colors={['#2563EB', '#1D4ED8']} style={successStyles.badge}>
        <MaterialIcons name="check" size={28} color="#FFFFFF" />
      </LinearGradient>
    </Animated.View>
  );
}
const successStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -20,
    alignSelf: 'center',
    zIndex: 50,
  },
  badge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
  },
});

// Format a quick amount value as "Rs. 1,000"
function formatQuickAmount(val: number): string {
  return `Rs. ${val.toLocaleString('en-US')}`;
}

export function RecoveryBottomSheet({
  visible,
  shop,
  companyId,
  onClose,
  onSubmit,
  isSubmitting,
}: RecoveryBottomSheetProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [gpsLat, setGpsLat] = useState<number | undefined>();
  const [gpsLng, setGpsLng] = useState<number | undefined>();
  const [gpsAddress, setGpsAddress] = useState<string | undefined>();
  const [capturingGps, setCapturingGps] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'amount' | 'note' | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [markGpsVisit, setMarkGpsVisit] = useState(true);

  // Slide-up animation
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const amountScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      // Auto-capture GPS if mark visit is on
      if (markGpsVisit) {
        captureGPS();
      }
    } else {
      slideAnim.setValue(400);
      fadeAnim.setValue(0);
      setShowSuccess(false);
    }
  }, [visible]);

  // Haptic feedback on amount change
  useEffect(() => {
    const val = parseInt(amount, 10);
    if (val > 0) {
      Animated.sequence([
        Animated.timing(amountScaleAnim, { toValue: 1.03, duration: 100, useNativeDriver: true }),
        Animated.timing(amountScaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [amount]);

  const reset = useCallback(() => {
    setAmount('');
    setDescription('');
    setGpsLat(undefined);
    setGpsLng(undefined);
    setGpsAddress(undefined);
    setFocusedField(null);
    setShowSuccess(false);
    setCapturingGps(false);
    setMapLoading(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleQuickAmount = (val: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmount(String(val));
  };

  const handleFullBalance = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { balance: displayBalance } = getShopDisplayBalance(shop as Shop, companyId);
    setAmount(String(Math.max(displayBalance, 0)));
  };

  const handlePhotoProof = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Photo Proof', 'Photo proof capture is coming soon. Stay tuned!');
  };

  const captureGPS = async () => {
    setCapturingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to capture GPS.');
        return;
      }

      let loc: Location.LocationObject | null = null;

      // Try with Balanced accuracy first, then fall back to Low for better offline support
      for (const accuracy of [Location.Accuracy.Balanced, Location.Accuracy.Low]) {
        try {
          loc = await Location.getCurrentPositionAsync({
            accuracy,
            timeInterval: 15000,
          });
          break; // success — exit loop
        } catch (e) {
          console.warn(`[GPS] Failed with accuracy ${accuracy}, retrying...`, e);
        }
      }

      if (!loc) {
        // Final fallback: try getting last known position
        try {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown) {
            loc = lastKnown;
          }
        } catch { /* ignore */ }
      }

      if (!loc) {
        Alert.alert('GPS Error', 'Could not get location. Please ensure GPS is enabled and you are outdoors, then try again.');
        return;
      }

      setGpsLat(loc.coords.latitude);
      setGpsLng(loc.coords.longitude);
      setMapLoading(true);
      // Reverse geocoding is optional — may fail offline
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (geo) {
          const parts = [geo.street, geo.district, geo.city].filter(Boolean);
          setGpsAddress(parts.join(', '));
        }
      } catch {
        // Offline: skip address, coordinates are enough
        setGpsAddress(undefined);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('GPS Error', 'Could not get location. Make sure GPS is enabled and try again.');
    } finally {
      setCapturingGps(false);
    }
  };

  const handleToggleGpsVisit = (value: boolean) => {
    setMarkGpsVisit(value);
    if (value && !hasGps) {
      captureGPS();
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubmit = async () => {
    const numAmount = parseInt(amount, 10);
    if (!numAmount || numAmount < MIN_RECOVERY) {
      Alert.alert('Invalid Amount', `Minimum recovery amount is ${formatPKR(MIN_RECOVERY)}`);
      return;
    }
    if (numAmount > MAX_RECOVERY) {
      Alert.alert('Invalid Amount', `Maximum recovery amount is ${formatPKR(MAX_RECOVERY)}`);
      return;
    }
    if (shop) {
      const { balance: displayBalance } = getShopDisplayBalance(shop, companyId);
      if (numAmount > displayBalance) {
        Alert.alert(
          'Exceeds Balance',
          `Recovery amount exceeds shop balance of ${formatPKR(displayBalance)}`
        );
        return;
      }
    }

    // Shop Visit Verification: Check if order booker is within 100m of the shop
    let outOfRange = false;
    if (shop && shop.lat != null && shop.lng != null && gpsLat != null && gpsLng != null) {
      const distance = getDistanceMeters(gpsLat, gpsLng, shop.lat, shop.lng);
      if (distance > 100) {
        const confirmed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Not Near Shop',
            `You are ${Math.round(distance)}m away from ${shop.name}. Confirm anyway?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Submit', style: 'default', onPress: () => resolve(true) },
            ],
            { cancelable: false }
          );
        });
        if (!confirmed) return;
        outOfRange = true;
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await onSubmit({
      amount: numAmount,
      description,
      gpsLat: markGpsVisit ? gpsLat : undefined,
      gpsLng: markGpsVisit ? gpsLng : undefined,
      gpsAddress: markGpsVisit ? gpsAddress : undefined,
      markGpsVisit,
      outOfRange: outOfRange || undefined,
    });
    setShowSuccess(true);
    setTimeout(() => {
      reset();
    }, 1500);
  };

  if (!shop) return null;

  const { balance: displayBalance, creditLimit: displayCreditLimit } = getShopDisplayBalance(shop, companyId);
  const numericAmount = parseInt(amount, 10) || 0;
  const mapUrl = gpsLat && gpsLng ? getOsmStaticUrl(gpsLat, gpsLng) : null;
  const hasGps = !!(gpsLat && gpsLng);
  const isValid = numericAmount >= MIN_RECOVERY && numericAmount <= MAX_RECOVERY && numericAmount <= displayBalance;
  const remainingBalance = displayBalance - numericAmount;
  const isFullBalance = numericAmount > 0 && numericAmount === displayBalance;
  const shopBalanceColor = displayBalance > 50000 ? '#EF4444' : displayBalance >= 10000 ? '#F59E0B' : '#10B981';

  // Quick amount chips: Rs. 1,000 / 2,000 / 5,000 / 10,000 / Full Balance
  const quickAmountChips = QUICK_AMOUNTS.filter((v) => v >= 1000).map((val) => ({
    key: `quick-${val}`,
    label: formatQuickAmount(val),
    value: val,
    isActive: amount === String(val),
    onPress: () => handleQuickAmount(val),
  }));
  quickAmountChips.push({
    key: 'full',
    label: 'Full Balance',
    value: displayBalance,
    isActive: isFullBalance,
    onPress: handleFullBalance,
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.modalRoot}>
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Animated.View style={[styles.backdropFade, { opacity: fadeAnim }]} />
        </Pressable>

        {/* Sheet container — stays at bottom, shrinks with keyboard on Android */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <Animated.View
            style={[
              styles.sheet,
              { transform: [{ translateY: slideAnim }], opacity: fadeAnim },
            ]}
          >
            <ConfettiOverlay visible={showSuccess} />
            <SuccessCheckmark visible={showSuccess} />

            {/* ============ HEADER BAR (title + close X) ============ */}
            <View style={styles.headerBar}>
              <View style={styles.headerBarLeft}>
                <View style={styles.headerBarIcon}>
                  <MaterialIcons name="payments" size={18} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.headerTitle}>New Recovery</Text>
                  <Text style={styles.headerSub}>Enter collection details</Text>
                </View>
              </View>
              <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
                <MaterialIcons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {/* ============ SELECTED SHOP MINI CARD ============ */}
            <View style={styles.shopMiniCard}>
              <LinearGradient
                colors={shopBalanceColor === '#EF4444' ? ['#EF4444', '#DC2626'] : shopBalanceColor === '#F59E0B' ? ['#F59E0B', '#D97706'] : ['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.shopMiniAvatar}
              >
                <Text style={styles.shopMiniAvatarText}>{shop.name.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
              <View style={styles.shopMiniInfo}>
                <Text style={styles.shopMiniName} numberOfLines={1}>{shop.name}</Text>
                <Text style={styles.shopMiniOwner} numberOfLines={1}>{shop.ownerName || shop.area}</Text>
              </View>
              <View style={styles.shopMiniBalanceCol}>
                <Text style={styles.shopMiniBalanceLabel}>BALANCE</Text>
                <Text style={[styles.shopMiniBalance, { color: shopBalanceColor }]}>
                  {formatPKR(displayBalance)}
                </Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.scrollView}>
              {/* ============ BIG AMOUNT INPUT (blue gradient) ============ */}
              <Animated.View style={[{ transform: [{ scale: amountScaleAnim }] }]}>
                <LinearGradient
                  colors={['#2563EB', '#1E40AF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.amountHero}
                >
                  <View style={styles.amountBubble1} />
                  <View style={styles.amountBubble2} />

                  <Text style={styles.amountHeroLabel}>ENTER AMOUNT</Text>

                  <View style={styles.amountHeroRow}>
                    <Text style={styles.amountCurrency}>Rs.</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      maxLength={7}
                      onFocus={() => setFocusedField('amount')}
                      onBlur={() => setFocusedField(null)}
                      autoFocus
                      selectTextOnFocus
                    />
                    {amount ? (
                      <Pressable
                        onPress={() => { setAmount(''); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        style={styles.amountClear}
                        hitSlop={8}
                      >
                        <MaterialIcons name="backspace" size={20} color="rgba(255,255,255,0.85)" />
                      </Pressable>
                    ) : (
                      <MaterialIcons name="keyboard" size={18} color="rgba(255,255,255,0.5)" />
                    )}
                  </View>

                  {/* Inline validation hint inside hero */}
                  {amount && numericAmount > 0 && numericAmount < MIN_RECOVERY ? (
                    <View style={styles.amountHintRow}>
                      <MaterialIcons name="info" size={12} color="rgba(255,255,255,0.85)" />
                      <Text style={styles.amountHintText}>Min: {formatPKR(MIN_RECOVERY)}</Text>
                    </View>
                  ) : numericAmount > displayBalance ? (
                    <View style={styles.amountHintRow}>
                      <MaterialIcons name="warning" size={12} color="#FECACA" />
                      <Text style={[styles.amountHintText, { color: '#FECACA' }]}>
                        Exceeds balance of {formatPKR(displayBalance)}
                      </Text>
                    </View>
                  ) : null}
                </LinearGradient>
              </Animated.View>

              {/* ============ QUICK AMOUNT CHIPS (horizontal row) ============ */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickChipsRow}
              >
                {quickAmountChips.map((chip) => (
                  <Pressable
                    key={chip.key}
                    style={({ pressed }) => [
                      styles.quickChip,
                      chip.isActive && styles.quickChipActive,
                      pressed && styles.quickChipPressed,
                    ]}
                    onPress={chip.onPress}
                  >
                    {chip.isActive ? (
                      <MaterialIcons name="check" size={12} color="#FFFFFF" />
                    ) : null}
                    <Text style={[styles.quickChipText, chip.isActive && styles.quickChipTextActive]}>
                      {chip.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* ============ BALANCE PREVIEW (after recovery) ============ */}
              {numericAmount > 0 && numericAmount <= displayBalance ? (
                <View style={styles.balancePreviewCard}>
                  <View style={styles.balancePreviewHeader}>
                    <MaterialIcons name="trending-down" size={14} color="#1E40AF" />
                    <Text style={styles.balancePreviewTitle}>AFTER THIS RECOVERY</Text>
                  </View>
                  <View style={styles.balancePreviewRow}>
                    <View style={styles.balancePreviewItem}>
                      <Text style={styles.balancePreviewLabel}>Current</Text>
                      <Text style={[styles.balancePreviewValue, { color: '#EF4444' }]}>
                        {formatPKR(displayBalance)}
                      </Text>
                    </View>
                    <MaterialIcons name="arrow-forward" size={16} color="#2563EB" />
                    <View style={styles.balancePreviewItem}>
                      <Text style={styles.balancePreviewLabel}>Remaining</Text>
                      <Text style={[styles.balancePreviewValue, { color: remainingBalance > 0 ? '#F59E0B' : '#10B981' }]}>
                        {formatPKR(remainingBalance)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.reductionBar}>
                    <View style={[styles.reductionBarFill, {
                      width: `${Math.min((numericAmount / Math.max(displayBalance, 1)) * 100, 100)}%`,
                    }]} />
                  </View>
                  <Text style={styles.reductionText}>
                    {((numericAmount / Math.max(displayBalance, 1)) * 100).toFixed(0)}% reduction
                  </Text>
                </View>
              ) : null}

              {/* ============ DESCRIPTION FIELD (optional) ============ */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Description (optional)</Text>
                </View>
                <View style={[styles.noteWrap, focusedField === 'note' && styles.noteWrapFocused]}>
                  <TextInput
                    style={styles.noteInput}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="e.g. Cash received, cheque, partial payment..."
                    placeholderTextColor={Colors.textMuted}
                    maxLength={200}
                    multiline
                    numberOfLines={2}
                    onFocus={() => setFocusedField('note')}
                    onBlur={() => setFocusedField(null)}
                  />
                  {description ? (
                    <Pressable
                      onPress={() => setDescription('')}
                      style={styles.noteClear}
                      hitSlop={8}
                    >
                      <MaterialIcons name="close" size={16} color={Colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* ============ GPS STORE VISIT TOGGLE ============ */}
              <View style={styles.section}>
                <View style={[styles.gpsVisitCard, markGpsVisit && styles.gpsVisitCardActive]}>
                  <View style={styles.gpsVisitLeft}>
                    <View style={styles.gpsVisitIconWrap}>
                      <MaterialIcons
                        name="storefront"
                        size={20}
                        color={markGpsVisit ? '#2563EB' : Colors.textMuted}
                      />
                    </View>
                    <View style={styles.gpsVisitTextWrap}>
                      <Text style={styles.gpsVisitTitle}>GPS Store Visit</Text>
                      <Text style={styles.gpsVisitSub}>
                        {markGpsVisit
                          ? 'GPS will be captured and shop marked as visited'
                          : 'Shop visit will not be recorded'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={markGpsVisit}
                    onValueChange={handleToggleGpsVisit}
                    trackColor={{ false: Colors.border, true: '#93C5FD' }}
                    thumbColor={Platform.OS === 'android' ? (markGpsVisit ? '#2563EB' : Colors.textMuted) : undefined}
                    ios_backgroundColor={Colors.border}
                  />
                </View>

                {/* GPS Location captured indicator — green pill with pulse */}
                {markGpsVisit && hasGps && (
                  <View style={styles.gpsCapturedPill}>
                    <GpsPulse active={true} color="#10B981" />
                    <MaterialIcons name="location-on" size={13} color="#10B981" />
                    <Text style={styles.gpsCapturedPillLabel} numberOfLines={1}>
                      Location captured · {gpsAddress || `${gpsLat!.toFixed(4)}, ${gpsLng!.toFixed(4)}`}
                    </Text>
                  </View>
                )}

                {markGpsVisit && capturingGps && (
                  <View style={styles.gpsCapturingPill}>
                    <ActivityIndicator size="small" color="#2563EB" />
                    <Text style={styles.gpsCapturingPillLabel}>Capturing GPS location...</Text>
                  </View>
                )}
              </View>

              {/* ============ GPS DETAIL CARD (when captured) ============ */}
              {markGpsVisit && hasGps ? (
                <View style={styles.section}>
                  <View style={styles.gpsCard}>
                    <View style={styles.mapContainer}>
                      {mapLoading ? (
                        <View style={styles.mapLoader}>
                          <ActivityIndicator size="small" color="#2563EB" />
                          <Text style={styles.mapLoaderText}>Loading map...</Text>
                        </View>
                      ) : null}
                      {mapUrl ? (
                        <Image
                          source={{ uri: mapUrl }}
                          style={[styles.mapImage, mapLoading && { opacity: 0 }]}
                          contentFit="cover"
                          transition={300}
                          onLoad={() => setMapLoading(false)}
                          onError={() => setMapLoading(false)}
                        />
                      ) : null}
                      <View style={styles.mapPinOverlay}>
                        <View style={styles.mapPin}>
                          <MaterialIcons name="location-on" size={28} color="#EF4444" />
                        </View>
                      </View>
                      <View style={styles.mapZoomBadge}>
                        <MaterialIcons name="zoom-in" size={12} color={Colors.textInverse} />
                        <Text style={styles.mapZoomText}>Street level</Text>
                      </View>
                    </View>

                    <View style={styles.gpsInfo}>
                      <View style={styles.coordsRow}>
                        <View style={styles.coordsBadge}>
                          <MaterialIcons name="gps-fixed" size={13} color="#1E40AF" />
                          <Text style={styles.coordsText}>
                            {gpsLat!.toFixed(5)}, {gpsLng!.toFixed(5)}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => { setGpsLat(undefined); setGpsLng(undefined); setGpsAddress(undefined); }}
                          style={styles.gpsRemoveBtn}
                          hitSlop={8}
                        >
                          <MaterialIcons name="delete-outline" size={16} color="#EF4444" />
                        </Pressable>
                      </View>

                      {gpsAddress ? (
                        <View style={styles.addressRow}>
                          <MaterialIcons name="place" size={13} color={Colors.textSecondary} />
                          <Text style={styles.addressText} numberOfLines={2}>{gpsAddress}</Text>
                        </View>
                      ) : null}

                      <Pressable
                        onPress={captureGPS}
                        style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
                        disabled={capturingGps}
                      >
                        <MaterialIcons
                          name={capturingGps ? 'sync' : 'refresh'}
                          size={14}
                          color="#1E40AF"
                          style={capturingGps ? { transform: [{ rotate: '180deg' }] } : {}}
                        />
                        <Text style={styles.retryBtnText}>
                          {capturingGps ? 'Updating...' : 'Update Location'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : markGpsVisit && !hasGps ? (
                <View style={styles.section}>
                  <Pressable
                    style={({ pressed }) => [styles.captureBtn, pressed && styles.captureBtnPressed]}
                    onPress={captureGPS}
                    disabled={capturingGps}
                  >
                    <View style={styles.captureBtnInner}>
                      <View style={styles.captureBtnIconWrap}>
                        {capturingGps ? (
                          <ActivityIndicator size="small" color="#2563EB" />
                        ) : (
                          <MaterialIcons name="add-location-alt" size={22} color="#2563EB" />
                        )}
                      </View>
                      <View style={styles.captureBtnTextWrap}>
                        <Text style={styles.captureBtnTitle}>
                          {capturingGps ? 'Getting location...' : 'Capture GPS Location'}
                        </Text>
                        <Text style={styles.captureBtnSub}>
                          {capturingGps ? 'Please wait...' : 'Verify your presence at the shop'}
                        </Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
                    </View>
                  </Pressable>
                </View>
              ) : null}

              {/* ============ PHOTO PROOF BUTTON (dashed border) ============ */}
              <View style={styles.section}>
                <Pressable
                  style={({ pressed }) => [styles.photoProofBtn, pressed && styles.photoProofBtnPressed]}
                  onPress={handlePhotoProof}
                >
                  <View style={styles.photoProofIconWrap}>
                    <MaterialIcons name="photo-camera" size={20} color="#2563EB" />
                  </View>
                  <View style={styles.photoProofTextWrap}>
                    <Text style={styles.photoProofTitle}>Add Photo Proof</Text>
                    <Text style={styles.photoProofSub}>Optional · Capture receipt or cash photo</Text>
                  </View>
                  <MaterialIcons name="add-a-photo" size={20} color={Colors.textMuted} />
                </Pressable>
              </View>

              <View style={styles.bottomPad} />
            </ScrollView>

            {/* ============ SUBMIT FOOTER ============ */}
            <View style={styles.footer}>
              {numericAmount > 0 && isValid ? (
                <View style={styles.amountPreview}>
                  <View>
                    <Text style={styles.amountPreviewLabel}>Recovery Amount</Text>
                    <Text style={styles.amountPreviewSub}>
                      This will reduce the outstanding balance
                      {markGpsVisit ? ' · GPS visit will be marked' : ''}
                    </Text>
                  </View>
                  <Text style={styles.amountPreviewValue}>{formatPKR(numericAmount)}</Text>
                </View>
              ) : null}

              {showSuccess ? (
                <View style={styles.successFooter}>
                  <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.successFooterInner}>
                    <MaterialIcons name="check-circle" size={24} color="#FFFFFF" />
                    <Text style={styles.successFooterText}>Recovery Submitted Successfully!</Text>
                  </LinearGradient>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.submitBtn,
                    (!isValid || isSubmitting) && styles.submitBtnDisabled,
                    pressed && isValid && !isSubmitting && styles.submitBtnPressed,
                  ]}
                  onPress={handleSubmit}
                  disabled={!isValid || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <ActivityIndicator size="small" color={Colors.textInverse} />
                      <Text style={styles.submitBtnText}>Submitting...</Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.submitBtnIcon}>
                        <MaterialIcons name="check" size={18} color={Colors.textInverse} />
                      </View>
                      <Text style={styles.submitBtnText}>Submit Recovery</Text>
                    </>
                  )}
                </Pressable>
              )}

              {/* Auto-approved note */}
              <View style={styles.autoApproveNote}>
                <MaterialIcons name="info" size={12} color="#94A3B8" />
                <Text style={styles.autoApproveText}>Recovery will be auto-approved by admin</Text>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backdropFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '93%',
    ...Shadow.lg,
  },
  // ===== Header bar =====
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  headerBarIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  headerSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ===== Selected shop mini card =====
  shopMiniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shopMiniAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopMiniAvatarText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  shopMiniInfo: {
    flex: 1,
  },
  shopMiniName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  shopMiniOwner: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  shopMiniBalanceCol: {
    alignItems: 'flex-end',
  },
  shopMiniBalanceLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: FontWeight.bold,
    letterSpacing: 0.4,
  },
  shopMiniBalance: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    marginTop: 1,
  },
  // ===== ScrollView =====
  scrollView: {
    paddingHorizontal: Spacing.md,
  },
  // ===== BIG AMOUNT HERO (blue gradient) =====
  amountHero: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    position: 'relative',
    overflow: 'hidden',
    ...Shadow.md,
  },
  amountBubble1: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -45,
    right: -25,
  },
  amountBubble2: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: -25,
    left: -10,
  },
  amountHeroLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  amountHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  amountCurrency: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: 'rgba(255,255,255,0.7)',
  },
  amountInput: {
    flex: 1,
    fontSize: 34,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    paddingVertical: 0,
    paddingHorizontal: 0,
    letterSpacing: -0.5,
  },
  amountClear: {
    padding: 4,
  },
  amountHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
  },
  amountHintText: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: FontWeight.medium,
  },
  // ===== Quick amount chips (horizontal) =====
  quickChipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingRight: Spacing.md,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  quickChipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#2563EB',
  },
  quickChipPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  quickChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#2563EB',
  },
  quickChipTextActive: {
    color: '#FFFFFF',
  },
  // ===== Balance preview card =====
  balancePreviewCard: {
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: Spacing.md,
    ...Shadow.sm,
  },
  balancePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: Spacing.sm,
  },
  balancePreviewTitle: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: '#1E40AF',
    letterSpacing: 0.6,
  },
  balancePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  balancePreviewItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  balancePreviewLabel: {
    fontSize: 10,
    color: '#64748B',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontWeight: FontWeight.medium,
  },
  balancePreviewValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  reductionBar: {
    height: 4,
    backgroundColor: 'rgba(37, 99, 235, 0.18)',
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  reductionBarFill: {
    height: 4,
    backgroundColor: '#2563EB',
    borderRadius: Radius.full,
  },
  reductionText: {
    fontSize: FontSize.xs,
    color: '#1E40AF',
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    marginTop: 4,
  },
  // ===== Section =====
  section: {
    marginTop: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    flex: 1,
  },
  // ===== Note input =====
  noteWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  noteWrapFocused: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  noteInput: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text,
    paddingVertical: Spacing.sm,
    minHeight: 52,
    textAlignVertical: 'top',
  },
  noteClear: {
    marginTop: Spacing.sm,
  },
  // ===== GPS Store Visit toggle =====
  gpsVisitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  gpsVisitCardActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  gpsVisitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  gpsVisitIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsVisitTextWrap: {
    flex: 1,
  },
  gpsVisitTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  gpsVisitSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  // ===== Green GPS captured pill =====
  gpsCapturedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  gpsCapturedPillLabel: {
    fontSize: FontSize.xs,
    color: '#059669',
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  gpsCapturingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FEF3C7',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    marginTop: Spacing.sm,
  },
  gpsCapturingPillLabel: {
    fontSize: FontSize.xs,
    color: '#92400E',
    fontWeight: FontWeight.medium,
  },
  // ===== GPS detail card =====
  gpsCard: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    ...Shadow.md,
  },
  mapContainer: {
    height: 170,
    backgroundColor: '#E5E7EB',
    position: 'relative',
    overflow: 'hidden',
  },
  mapLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    gap: Spacing.xs,
    zIndex: 1,
  },
  mapLoaderText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapPinOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  mapPin: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 4,
    ...Shadow.md,
  },
  mapZoomBadge: {
    position: 'absolute',
    bottom: Spacing.xs,
    right: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  mapZoomText: {
    fontSize: 10,
    color: Colors.textInverse,
    fontWeight: FontWeight.medium,
  },
  gpsInfo: {
    padding: Spacing.sm,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  coordsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    backgroundColor: '#DBEAFE',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  coordsText: {
    fontSize: FontSize.xs,
    color: '#1E40AF',
    fontWeight: FontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },
  gpsRemoveBtn: {
    padding: 6,
    marginLeft: Spacing.sm,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  addressText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: '#DBEAFE',
  },
  retryBtnText: {
    fontSize: FontSize.sm,
    color: '#1E40AF',
    fontWeight: FontWeight.semibold,
  },
  // ===== GPS capture button =====
  captureBtn: {
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.md,
  },
  captureBtnPressed: { opacity: 0.85 },
  captureBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  captureBtnIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnTextWrap: {
    flex: 1,
  },
  captureBtnTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  captureBtnSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  // ===== Photo proof button (dashed border) =====
  photoProofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
  },
  photoProofBtnPressed: { opacity: 0.8 },
  photoProofIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoProofTextWrap: {
    flex: 1,
  },
  photoProofTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  photoProofSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  bottomPad: {
    height: Spacing.lg,
  },
  // ===== Footer =====
  footer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? Spacing.xl : Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  amountPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: '#DBEAFE',
  },
  amountPreviewLabel: {
    fontSize: FontSize.sm,
    color: '#1E40AF',
    fontWeight: FontWeight.bold,
  },
  amountPreviewSub: {
    fontSize: FontSize.xs,
    color: '#2563EB',
    marginTop: 1,
  },
  amountPreviewValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#1E40AF',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#2563EB',
    borderRadius: 30,
    paddingVertical: 16,
    ...Shadow.md,
  },
  submitBtnDisabled: {
    backgroundColor: '#CBD5E1',
    elevation: 0,
    shadowOpacity: 0,
  },
  submitBtnPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  submitBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
  submitBtnIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successFooter: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  successFooterInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 16,
  },
  successFooterText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  // ===== Auto-approved note =====
  autoApproveNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 2,
  },
  autoApproveText: {
    fontSize: FontSize.xs,
    color: '#94A3B8',
    fontWeight: FontWeight.medium,
  },
});
