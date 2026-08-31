// Powered by Finexa
// Login Screen — AURORA GLASS design (mockup screen 1):
// brand-gradient hero (rounded bottom 28px) with glass logo tile + welcome
// copy, aurora light page background, glass input cards with leading icons,
// gradient primary button with indigo glow.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import { useShops } from '@/hooks/useShops';
import { useLock } from '@/hooks/useLock';
import { SecureStorageService } from '@/services/secureStorage';
import { AURORA, Colors, Spacing, FontSize, FontWeight, Shadow } from '@/constants/theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();
  const { triggerFullSync } = useShops();
  const { setNeedsPinSetup, resetIdleTimer } = useLock();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [syncingData, setSyncingData] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both username and password.');
      return;
    }
    setIsLoading(true);
    try {
      await login(username.trim(), password.trim());
      setSyncingData(true);
      try {
        const { StorageService } = await import('@/services/storage');
        const savedUser = await StorageService.getUser();
        if (savedUser) {
          await triggerFullSync(savedUser.id, !!savedUser.allRoutesEnabled);
        }
      } catch {
        // Non-critical
      } finally {
        setSyncingData(false);
      }
      // After successful login + sync, check if PIN is set
      const hasPin = await SecureStorageService.hasPin();
      if (!hasPin) {
        // First-time login — trigger PIN setup
        setNeedsPinSetup(true);
        resetIdleTimer();
      } else {
        resetIdleTimer();
      }
      // After successful login, navigate to root — the root router will
      // evaluate the correct next step (download, route-start, or tabs)
      // Use setTimeout to ensure React state has been processed before navigation
      setTimeout(() => {
        router.replace('/');
      }, 100);
    } catch (e: any) {
      const msg = e?.message || 'Invalid username or password.';
      setErrorMessage(msg);
      Alert.alert('Login Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const busy = isLoading || syncingData;

  return (
    <View style={styles.root}>
      {/* ── Aurora page background: soft violet/indigo tints on #F8FAFC ── */}
      <LinearGradient
        colors={['#EDE9FE', '#F8FAFC', '#EEF2FF']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Aurora radial tint blobs (top-left violet / bottom-right indigo) */}
      <View style={styles.auroraBlobA} pointerEvents="none" />
      <View style={styles.auroraBlobB} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── HERO (mockup .login-hero): brand gradient, rounded bottom 28 ── */}
          <LinearGradient
            colors={[...AURORA.brandGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.loginHero}
          >
            {/* gradient-glow overlay */}
            <View style={styles.heroGlow} pointerEvents="none" />
            <View style={styles.heroBubble1} pointerEvents="none" />
            <View style={styles.heroBubble2} pointerEvents="none" />

            {/* Glass logo tile (mockup .login-logo: 64px, glass, r-18) */}
            <View style={styles.loginLogo}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.logoImage}
                contentFit="contain"
              />
            </View>
            <Text style={styles.heroTitle}>Finexa mein{'\n'}khush amdeed</Text>
            <Text style={styles.heroSubtitle}>Orderbooker account mein login karein</Text>
          </LinearGradient>

          {/* ── BODY (mockup .login-body) on aurora background ── */}
          <View style={styles.loginBody}>
            {/* Username — glass input with leading icon (mockup .input-wrap) */}
            <View style={styles.inputField}>
              <MaterialIcons name="person" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.inputText}
                value={username}
                onChangeText={(v) => {
                  setUsername(v);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Username"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            {/* Password — glass input with leading + eye icon */}
            <View style={styles.inputField}>
              <MaterialIcons name="lock" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.inputText}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Password"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={10}
                style={styles.eyeToggle}
              >
                <MaterialIcons
                  name={showPassword ? 'visibility-off' : 'visibility'}
                  size={20}
                  color={Colors.textSecondary}
                />
              </Pressable>
            </View>

            {/* Inline error message box */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={16} color={AURORA.chipDangerText} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Sign In — brand gradient button with glow (mockup .btn-primary) */}
            <Pressable
              style={({ pressed }) => [
                styles.signInBtn,
                pressed && !busy && { opacity: 0.92, transform: [{ scale: 0.98 }] },
              ]}
              onPress={handleLogin}
              disabled={busy}
            >
              <LinearGradient
                colors={[...AURORA.brandGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.signInBtnGradient}
              >
                {busy ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.signInBtnText}>
                      {syncingData ? 'Syncing data...' : 'Signing in...'}
                    </Text>
                  </>
                ) : (
                  <>
                    <MaterialIcons name="login" size={20} color="#FFFFFF" />
                    <Text style={styles.signInBtnText}>Sign In</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>

          {/* Footer */}
          <Text style={styles.footerText}>Powered by Finexa</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AURORA.bgPage,
  },
  // Aurora tint blobs (radial gradient approximation)
  auroraBlobA: {
    position: 'absolute',
    top: -160,
    left: -120,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(124,58,237,0.20)',
  },
  auroraBlobB: {
    position: 'absolute',
    bottom: -140,
    right: -110,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(79,70,229,0.18)',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },

  // ── Hero (login-hero: 60px top / 40px bottom padding, rounded bottom 28) ──
  loginHero: {
    alignItems: 'flex-start',
    paddingTop: 56,
    paddingBottom: 36,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  heroBubble1: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroBubble2: {
    position: 'absolute',
    bottom: -70,
    left: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  // Glass logo tile (64px, r-18, white glass bg + border)
  loginLogo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  logoImage: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: FontWeight.extrabold,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 36,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },

  // ── Body (login-body: 32px top, 24px sides) ──
  loginBody: {
    paddingTop: Spacing.xl,
  },

  // ── Glass inputs (input: elevated glass, r-12, 1.5px border) ──
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 54,
    backgroundColor: AURORA.bgElevated,
    borderWidth: 1.5,
    borderColor: AURORA.borderDefault,
    borderRadius: 12,
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  inputText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: 0,
    height: '100%',
  },
  eyeToggle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Error box ──
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: AURORA.chipDangerBg,
    borderWidth: 1,
    borderColor: AURORA.chipDangerBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: AURORA.chipDangerText,
    fontWeight: FontWeight.semibold,
  },

  // ── Sign In button (btn-primary: brand gradient + glow shadow) ──
  signInBtn: {
    height: 54,
    borderRadius: 12,
    overflow: 'hidden',
    ...Shadow.button,
  },
  signInBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  signInBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // ── Footer ──
  footerText: {
    textAlign: 'center',
    marginTop: Spacing.xxl,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.6,
  },
});
