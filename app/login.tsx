// Powered by Finexa
// Login Screen — Modern blue-gradient design with white card form,
// inline error box, and icon-decorated inputs.
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
import { Colors, Spacing, FontSize, FontWeight, Shadow } from '@/constants/theme';

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
      {/* Full-screen blue gradient background */}
      <LinearGradient
        colors={['#1E40AF', '#2563EB', '#3B82F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative floating bubbles */}
      <View style={styles.bubbleA} pointerEvents="none" />
      <View style={styles.bubbleB} pointerEvents="none" />
      <View style={styles.bubbleC} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.lg },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── TOP SECTION (≈40%) — Branding ── */}
          <View style={styles.brandSection}>
            <View style={styles.logoOuterCircle}>
              <View style={styles.logoInnerCircle}>
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

          {/* ── BOTTOM SECTION — White Login Card ── */}
          <View style={styles.formCard}>
            {/* Card header */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Welcome Back</Text>
              <Text style={styles.cardSubtitle}>Sign in to continue</Text>
            </View>

            {/* Username */}
            <Text style={styles.fieldLabel}>Username</Text>
            <View style={styles.inputField}>
              <View style={styles.inputIconBox}>
                <MaterialIcons name="person" size={20} color="#2563EB" />
              </View>
              <TextInput
                style={styles.inputText}
                value={username}
                onChangeText={(v) => {
                  setUsername(v);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter your username"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            {/* Password */}
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.inputField}>
              <View style={styles.inputIconBox}>
                <MaterialIcons name="lock" size={20} color="#2563EB" />
              </View>
              <TextInput
                style={styles.inputText}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter your password"
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
                <MaterialIcons name="error-outline" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Sign In Button — blue gradient, 56px tall, 14px radius */}
            <Pressable
              style={({ pressed }) => [
                styles.signInBtn,
                pressed && !busy && { opacity: 0.92 },
              ]}
              onPress={handleLogin}
              disabled={busy}
            >
              <LinearGradient
                colors={['#2563EB', '#3B82F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
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
    backgroundColor: '#1E40AF',
  },
  // Decorative bubbles
  bubbleA: {
    position: 'absolute',
    top: -120,
    right: -120,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bubbleB: {
    position: 'absolute',
    bottom: -90,
    left: -90,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  bubbleC: {
    position: 'absolute',
    top: '38%',
    right: -50,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    justifyContent: 'space-between',
  },

  // ── Brand / Top Section ──
  brandSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    // ~40% of screen — give it room to breathe
    minHeight: 280,
  },
  logoOuterCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadow.xl,
  },
  logoInnerCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  brandTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.8,
  },

  // ── White Form Card ──
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    ...Shadow.xl,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  cardTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  // ── Field labels & inputs ──
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    marginBottom: Spacing.md,
    paddingRight: 6,
    paddingLeft: 6,
  },
  inputIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  inputText: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text,
    paddingVertical: 0,
    height: '100%',
  },
  eyeToggle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Error box ──
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: '#DC2626',
    fontWeight: FontWeight.semibold,
  },

  // ── Sign In button ──
  signInBtn: {
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    ...Shadow.md,
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
    letterSpacing: 0.5,
  },

  // ── Footer ──
  footerText: {
    textAlign: 'center',
    marginTop: Spacing.lg,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.6,
  },
});
