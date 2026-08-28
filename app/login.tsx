// ═══════════════════════════════════════════════════════════════════════════
//  Aurora Glass Login — Premium glassmorphic login on midnight aurora backdrop
//  Replaces the old white-card-on-blue-gradient design
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { useAuth } from '@/hooks/useAuth';
import { useShops } from '@/hooks/useShops';
import { useLock } from '@/hooks/useLock';
import { SecureStorageService } from '@/services/secureStorage';
import {
  AuroraBackground,
  GlassCard,
  NeonButton,
  GlassInput,
  AuroraColors,
  AuroraFont,
  AuroraSpacing,
  AuroraRadius,
  AuroraShadow,
} from '@/components/aurora';
import { LinearGradient } from 'expo-linear-gradient';

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
    <AuroraBackground topTint={AuroraColors.bgVoid}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + AuroraSpacing.xl, paddingBottom: insets.bottom + AuroraSpacing.lg },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Brand / Top Section ── */}
          <View style={styles.brandSection}>
            {/* Logo with neon glow halo */}
            <View style={styles.logoHalo}>
              <LinearGradient
                colors={['rgba(99, 102, 241, 0.35)', 'rgba(167, 139, 250, 0.20)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.logoOuter}>
                <Image
                  source={require('@/assets/images/logo.png')}
                  style={styles.logoImage}
                  contentFit="contain"
                />
              </View>
            </View>

            <Text style={styles.brandTitle}>Finexa</Text>
            <Text style={styles.brandSubtitle}>Credit &amp; Recovery System</Text>
          </View>

          {/* ── Glass Login Card ── */}
          <GlassCard variant="strong" padding="xl" radius="xl" glow="indigo" style={styles.formCard}>
            {/* Card header */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Welcome Back</Text>
              <Text style={styles.cardSubtitle}>Sign in to continue</Text>
            </View>

            {/* Username */}
            <GlassInput
              label="Username"
              value={username}
              onChangeText={(v) => {
                setUsername(v);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Enter your username"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              leftIcon={<MaterialIcons name="person" size={20} color={AuroraColors.neonViolet} />}
              error={errorMessage ?? undefined}
            />

            {/* Password */}
            <View style={{ height: AuroraSpacing.md }} />
            <GlassInput
              label="Password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              leftIcon={<MaterialIcons name="lock" size={20} color={AuroraColors.neonViolet} />}
              rightIcon={
                <MaterialIcons
                  name={showPassword ? 'visibility-off' : 'visibility'}
                  size={20}
                  color={AuroraColors.textSecondary}
                />
              }
              onRightIconPress={() => setShowPassword((v) => !v)}
            />

            {/* Inline error message box */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={16} color={AuroraColors.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Sign In Button */}
            <View style={styles.buttonWrap}>
              <NeonButton
                label={busy ? (syncingData ? 'Syncing data...' : 'Signing in...') : 'Sign In'}
                onPress={handleLogin}
                disabled={busy}
                loading={busy}
                variant="primary"
                size="lg"
                fullWidth
                icon={
                  !busy ? <MaterialIcons name="login" size={20} color="#FFFFFF" /> : undefined
                }
              />
            </View>
          </GlassCard>

          {/* Footer */}
          <Text style={styles.footerText}>Powered by Finexa</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: AuroraSpacing.lg,
    justifyContent: 'space-between',
  },

  // ── Brand / Top Section ──
  brandSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: AuroraSpacing.xxl,
    minHeight: 240,
  },
  logoHalo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: AuroraSpacing.md,
    overflow: 'hidden',
    ...AuroraShadow.neonStrong,
  },
  logoOuter: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AuroraColors.glassBorder,
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  brandTitle: {
    fontSize: 44,
    fontWeight: AuroraFont.weight.black,
    color: AuroraColors.text,
    letterSpacing: 1.4,
    marginBottom: 4,
    textShadowColor: AuroraColors.neonGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  brandSubtitle: {
    fontSize: AuroraFont.size.sm,
    color: AuroraColors.textSecondary,
    fontWeight: AuroraFont.weight.semibold,
    letterSpacing: AuroraFont.tracking.wider,
  },

  // ── Form Card ──
  formCard: {
    marginVertical: AuroraSpacing.md,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: AuroraSpacing.lg,
  },
  cardTitle: {
    fontSize: AuroraFont.size.xxl,
    fontWeight: AuroraFont.weight.bold,
    color: AuroraColors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: AuroraFont.size.sm,
    color: AuroraColors.textSecondary,
  },

  // ── Error box ──
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.30)',
    borderRadius: AuroraRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: AuroraSpacing.md,
    marginTop: AuroraSpacing.xs,
  },
  errorText: {
    flex: 1,
    fontSize: AuroraFont.size.sm,
    color: AuroraColors.danger,
    fontWeight: AuroraFont.weight.semibold,
  },

  buttonWrap: {
    marginTop: AuroraSpacing.sm,
  },

  // ── Footer ──
  footerText: {
    textAlign: 'center',
    marginTop: AuroraSpacing.lg,
    fontSize: AuroraFont.size.xs,
    color: AuroraColors.textMuted,
    fontWeight: AuroraFont.weight.semibold,
    letterSpacing: AuroraFont.tracking.wider,
  },
});
