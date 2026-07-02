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
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';

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

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Required Fields', 'Please enter username and password.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await login(username.trim(), password.trim());
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
      Alert.alert('Login Failed', e.message || 'Invalid username or password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#1E40AF', '#2563EB', '#3B82F6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      {/* Decorative floating circles */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />
      <View style={styles.decorCircle3} />

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + Spacing.xxl, paddingBottom: insets.bottom + Spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo — White circle with building icon */}
          <View style={styles.logoArea}>
            <View style={styles.logoCircle}>
              <View style={styles.logoCircleInner}>
                <Image
                  source={require('@/assets/images/logo.png')}
                  style={styles.logo}
                  contentFit="contain"
                />
              </View>
            </View>
            <Text style={styles.appTitle}>Finexa</Text>
            <View style={styles.subtitleWrap}>
              <View style={styles.subtitleDot} />
              <Text style={styles.appSubtitle}>Credit &amp; Recovery System</Text>
              <View style={styles.subtitleDot} />
            </View>
          </View>

          {/* White Login Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Welcome Back</Text>
              <Text style={styles.cardSubtitle}>Sign in to your account to continue</Text>
            </View>

            {/* Username field */}
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputIconWrap}>
                <MaterialIcons name="person" size={20} color="#2563EB" />
              </View>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your username"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            {/* Password field */}
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputIconWrap}>
                <MaterialIcons name="lock" size={20} color="#2563EB" />
              </View>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={12}
                style={styles.eyeBtn}
              >
                <MaterialIcons
                  name={showPassword ? 'visibility-off' : 'visibility'}
                  size={20}
                  color={Colors.textSecondary}
                />
              </Pressable>
            </View>

            {/* Login button */}
            <Pressable
              style={({ pressed }) => [
                styles.signInBtnWrap,
                (isLoading || !username || !password) && styles.signInBtnDisabled,
                pressed && !isLoading && styles.signInBtnPressed,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <LinearGradient
                colors={['#2563EB', '#1E40AF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signInBtnGradient}
              >
                {isLoading || syncingData ? (
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

            {/* Error area placeholder — red if any (rendered by Alert, kept for layout) */}
          </View>

          {/* Footer */}
          <View style={styles.footerWrap}>
            <View style={styles.footerLine} />
            <Text style={styles.footer}>Powered by Finexa</Text>
            <View style={styles.footerLine} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  decorCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  decorCircle3: {
    position: 'absolute',
    top: '40%',
    left: -60,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadow.xl,
  },
  logoCircleInner: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  appTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  subtitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  subtitleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  appSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: FontWeight.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: Spacing.lg,
    ...Shadow.xl,
    marginBottom: Spacing.lg,
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
    textAlign: 'center',
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    marginBottom: Spacing.md,
    height: 54,
    paddingHorizontal: Spacing.xs,
  },
  inputIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text,
    paddingHorizontal: Spacing.sm,
  },
  eyeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInBtnWrap: {
    borderRadius: 16,
    marginTop: Spacing.sm,
    overflow: 'hidden',
    ...Shadow.md,
  },
  signInBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 16,
  },
  signInBtnDisabled: { opacity: 0.5 },
  signInBtnPressed: { opacity: 0.9 },
  signInBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  footerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  footerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  footer: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
