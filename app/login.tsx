// =================================================================
// AURORA GLASS — LOGIN SCREEN
// • Brand gradient hero (indigo→violet→indigo) with white text
// • Glassmorphic "F" logo box on hero
// • Slate-50 body with white glassmorphic inputs
// • Brand gradient CTA button with indigo glow shadow
// • Matches HTML mockup (finexa-app-preview-v2.html) Aurora style
// =================================================================
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import { AuroraBackground, GlassCard, NeonButton, GlassInput } from '@/components/aurora';
import {
  AuroraColors,
  AuroraFont,
  AuroraRadius,
  AuroraShadow,
  AuroraGradients,
} from '@/constants/auroraTheme';

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
      const hasPin = await SecureStorageService.hasPin();
      if (!hasPin) {
        setNeedsPinSetup(true);
        resetIdleTimer();
      } else {
        resetIdleTimer();
      }
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
    <AuroraBackground style={styles.root}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ─────────────────────────────────────────────────────
              TOP HERO — brand gradient with white text
              ───────────────────────────────────────────────────── */}
          <View style={styles.heroWrap}>
            <LinearGradient
              colors={[
                AuroraGradients.brandStart, // #4F46E5
                AuroraGradients.brandMid, // #7C3AED
                AuroraGradients.brandEnd, // #6366F1
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Floating glassmorphic "F" logo box on hero */}
            <View style={styles.logoBox}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.logoImage}
                contentFit="contain"
              />
            </View>

            <Text style={styles.heroTitle}>Finexa mein{'\n'}khush amdeed</Text>
            <Text style={styles.heroSubtitle}>
              Orderbooker account mein login karein
            </Text>
          </View>

          {/* ─────────────────────────────────────────────────────
              BODY — light slate-50 with glassmorphic form card
              ───────────────────────────────────────────────────── */}
          <View style={styles.bodyWrap}>
            <GlassCard glow="brand" padding="lg" style={styles.formCard}>
              {/* Card header */}
              <Text style={styles.cardTitle}>Sign In</Text>
              <Text style={styles.cardSubtitle}>
                Apna username aur password darj karein
              </Text>

              {/* Username input */}
              <View style={styles.fieldWrap}>
                <GlassInput
                  value={username}
                  onChangeText={(v) => {
                    setUsername(v);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Username"
                  placeholderTextColor={AuroraColors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  leadingIcon={
                    <MaterialIcons
                      name="person"
                      size={20}
                      color={AuroraColors.indigo600}
                    />
                  }
                />
              </View>

              {/* Password input */}
              <View style={styles.fieldWrap}>
                <GlassInput
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Password"
                  placeholderTextColor={AuroraColors.textMuted}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  leadingIcon={
                    <MaterialIcons
                      name="lock"
                      size={20}
                      color={AuroraColors.indigo600}
                    />
                  }
                  trailingIcon={
                    <Pressable
                      onPress={() => setShowPassword((v) => !v)}
                      hitSlop={10}
                    >
                      <MaterialIcons
                        name={showPassword ? 'visibility-off' : 'visibility'}
                        size={20}
                        color={AuroraColors.textSecondary}
                      />
                    </Pressable>
                  }
                />
              </View>

              {/* Inline error message box */}
              {errorMessage ? (
                <View style={styles.errorBox}>
                  <MaterialIcons
                    name="error-outline"
                    size={16}
                    color={AuroraColors.rose600}
                  />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Primary CTA — brand gradient with glow */}
              <View style={styles.ctaWrap}>
                <NeonButton
                  label={
                    busy
                      ? syncingData
                        ? 'Syncing data...'
                        : 'Signing in...'
                      : 'Sign In →'
                  }
                  onPress={handleLogin}
                  loading={busy}
                  icon={
                    !busy && (
                      <MaterialIcons
                        name="login"
                        size={20}
                        color={AuroraColors.textInverse}
                      />
                    )
                  }
                />
              </View>
            </GlassCard>

            {/* Footer */}
            <Text style={styles.footerText}>Powered by Finexa</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // ── HERO ──────────────────────────────────────────────────────
  heroWrap: {
    paddingTop: 60,
    paddingBottom: 56,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: AuroraRadius.r2xl, // 28
    borderBottomRightRadius: AuroraRadius.r2xl,
    overflow: 'hidden',
    ...AuroraShadow.lg,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: AuroraColors.glassOnGradient, // rgba(255,255,255,0.18)
    borderWidth: 1,
    borderColor: AuroraColors.glassOnGradientBorder, // rgba(255,255,255,0.28)
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  heroTitle: {
    fontFamily: AuroraFont.display,
    fontSize: 30,
    fontWeight: AuroraFont.extrabold,
    letterSpacing: -0.6,
    color: AuroraColors.textInverse,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 36,
  },
  heroSubtitle: {
    fontFamily: AuroraFont.sans,
    fontSize: 14,
    color: AuroraColors.glassOnGradientText, // rgba(255,255,255,0.92)
    textAlign: 'center',
  },

  // ── BODY ───────────────────────────────────────────────────────
  bodyWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  formCard: {
    padding: 24,
  },
  cardTitle: {
    fontFamily: AuroraFont.display,
    fontSize: AuroraFont.fsXl, // 20
    fontWeight: AuroraFont.extrabold,
    color: AuroraColors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: AuroraFont.sans,
    fontSize: AuroraFont.fsSm, // 13
    color: AuroraColors.textSecondary,
    marginBottom: 20,
  },
  fieldWrap: {
    marginBottom: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: AuroraColors.roseLight,
    borderWidth: 1,
    borderColor: AuroraColors.roseBorder,
    borderRadius: AuroraRadius.rMd,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontFamily: AuroraFont.sans,
    fontSize: AuroraFont.fsSm,
    color: AuroraColors.rose600,
    fontWeight: AuroraFont.medium,
  },
  ctaWrap: {
    marginTop: 4,
  },
  footerText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: AuroraFont.fsXs, // 11
    color: AuroraColors.textMuted,
    fontFamily: AuroraFont.sans,
  },
});
