// =================================================================
// AURORA GLASS — SETUP URL SCREEN
// • Brand gradient hero (indigo→violet→indigo) with floating glassmorphic icon
// • Slate-50 body with white glassmorphic form card
// • GlassInput for URL field, NeonButton for primary CTA
// • AuroraBackground floating orbs underneath
// =================================================================
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { AuroraBackground, GlassCard, NeonButton, GlassInput } from '@/components/aurora';
import {
  AuroraColors,
  AuroraFont,
  AuroraRadius,
  AuroraShadow,
  AuroraGradients,
} from '@/constants/auroraTheme';

export default function SetupUrlScreen() {
  const insets = useSafeAreaInsets();
  const { setApiUrl } = useAuth();
  const [url, setUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!url.trim()) {
      Alert.alert('Required', 'Please enter a URL');
      return;
    }

    // Basic URL validation
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    // Remove trailing slash
    finalUrl = finalUrl.replace(/\/$/, '');

    setIsSaving(true);
    try {
      // Test the URL by hitting /api/ping
      const res = await fetch(`${finalUrl}/api/ping`);
      if (!res.ok) throw new Error('Server not responding');
      const data = await res.json();
      if (!data.status) throw new Error('Invalid server response');

      await setApiUrl(finalUrl);
      // Navigate directly to login — this avoids the race condition with root router
      // where React state hasn't updated yet when router.replace('/') fires
      // Small delay ensures AsyncStorage write is committed and React state is processed
      setTimeout(() => {
        router.replace('/login');
      }, 100);
    } catch (e: any) {
      Alert.alert(
        'Connection Failed',
        `Server se connect nahi ho raha:\n${e.message}\n\nURL check karein aur dobara try karein.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AuroraBackground style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─────────────────────────────────────────────────────
              TOP HERO — brand gradient
              ───────────────────────────────────────────────────── */}
          <View style={styles.heroWrap}>
            <LinearGradient
              colors={[
                AuroraGradients.brandStart,
                AuroraGradients.brandMid,
                AuroraGradients.brandEnd,
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Floating glassmorphic icon orb */}
            <View style={styles.iconCircle}>
              <MaterialIcons name="link" size={40} color={AuroraColors.textInverse} />
            </View>

            <Text style={styles.title}>Finexa Smart{'\n'}Credit Routes</Text>
            <Text style={styles.subtitle}>Server URL Setup</Text>
          </View>

          {/* ─────────────────────────────────────────────────────
              BODY — glass form card
              ───────────────────────────────────────────────────── */}
          <View style={styles.bodyWrap}>
            <GlassCard glow="brand" padding="lg" style={styles.card}>
              <Text style={styles.cardTitle}>Enter Server URL</Text>
              <Text style={styles.cardDesc}>
                Apne distributor ka server URL enter karein. Ye sirf ek baar setup karna hai.
              </Text>

              <View style={styles.fieldWrap}>
                <GlassInput
                  value={url}
                  onChangeText={setUrl}
                  placeholder="e.g. https://your-company.vercel.app"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                  leadingIcon={
                    <MaterialIcons
                      name="cloud"
                      size={20}
                      color={AuroraColors.indigo600}
                    />
                  }
                />
              </View>

              <NeonButton
                label={isSaving ? 'Connecting...' : 'Connect & Save'}
                onPress={handleSave}
                loading={isSaving}
                disabled={!url.trim()}
                icon={
                  !isSaving && (
                    <MaterialIcons
                      name="check-circle"
                      size={20}
                      color={AuroraColors.textInverse}
                    />
                  )
                }
              />
            </GlassCard>

            <Text style={styles.footer}>
              App data clear karne par URL bhi remove ho jayega
            </Text>
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
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },

  // ── HERO ──────────────────────────────────────────────────────
  heroWrap: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: AuroraRadius.r2xl,
    borderBottomRightRadius: AuroraRadius.r2xl,
    overflow: 'hidden',
    ...AuroraShadow.lg,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: AuroraColors.glassOnGradient,
    borderWidth: 1,
    borderColor: AuroraColors.glassOnGradientBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  title: {
    fontFamily: AuroraFont.display,
    fontSize: 28,
    fontWeight: AuroraFont.extrabold as any,
    letterSpacing: -0.4,
    color: AuroraColors.textInverse,
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: AuroraFont.sans,
    fontSize: 14,
    color: AuroraColors.glassOnGradientText,
    textAlign: 'center',
    fontWeight: AuroraFont.medium as any,
  },

  // ── BODY ───────────────────────────────────────────────────────
  bodyWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  card: {
    padding: 24,
  },
  cardTitle: {
    fontFamily: AuroraFont.display,
    fontSize: AuroraFont.fsXl, // 20
    fontWeight: AuroraFont.extrabold as any,
    color: AuroraColors.textPrimary,
    marginBottom: 4,
  },
  cardDesc: {
    fontFamily: AuroraFont.sans,
    fontSize: AuroraFont.fsSm, // 13
    color: AuroraColors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  fieldWrap: {
    marginBottom: 16,
  },
  footer: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: AuroraFont.fsXs, // 11
    color: AuroraColors.textMuted,
    fontFamily: AuroraFont.sans,
  },
});
