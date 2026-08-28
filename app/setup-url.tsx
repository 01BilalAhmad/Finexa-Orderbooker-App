// ═══════════════════════════════════════════════════════════════════════════
//  Aurora Glass — Setup URL Screen (first-time server URL setup)
//  Replaces blue gradient + white card with Aurora glassmorphic design
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
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

export default function SetupUrlScreen() {
  const { setApiUrl } = useAuth();
  const [url, setUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!url.trim()) {
      Alert.alert('Required', 'Please enter a URL');
      return;
    }

    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }
    finalUrl = finalUrl.replace(/\/$/, '');

    setIsSaving(true);
    try {
      const res = await fetch(`${finalUrl}/api/ping`);
      if (!res.ok) throw new Error('Server not responding');
      const data = await res.json();
      if (!data.status) throw new Error('Invalid server response');

      await setApiUrl(finalUrl);
      setTimeout(() => {
        router.replace('/login');
      }, 100);
    } catch (e: any) {
      Alert.alert(
        'Connection Failed',
        `Server se connect nahi ho raha:\n${e.message}\n\nURL check karein aur dobara try karein.`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AuroraBackground topTint={AuroraColors.bgVoid}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoArea}>
            {/* Icon with neon halo */}
            <View style={styles.iconHalo}>
              <LinearGradient
                colors={['rgba(99, 102, 241, 0.35)', 'rgba(167, 139, 250, 0.20)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.iconCircle}>
                <MaterialIcons name="link" size={42} color={AuroraColors.neonViolet} />
              </View>
            </View>
            <Text style={styles.title}>Finexa Smart Credit</Text>
            <Text style={styles.subtitle}>Server URL Setup</Text>
          </View>

          <GlassCard variant="strong" padding="xl" radius="xl" glow="indigo" style={styles.card}>
            <Text style={styles.cardTitle}>Enter Server URL</Text>
            <Text style={styles.cardDesc}>
              Apne distributor ka server URL enter karein. Ye sirf ek baar setup karna hai.
            </Text>

            <View style={{ height: AuroraSpacing.md }} />

            <GlassInput
              label="Server URL"
              value={url}
              onChangeText={setUrl}
              placeholder="e.g. https://your-company.vercel.app"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={handleSave}
              leftIcon={<MaterialIcons name="cloud" size={20} color={AuroraColors.neonViolet} />}
            />

            <View style={styles.buttonWrap}>
              <NeonButton
                label={isSaving ? 'Connecting...' : 'Connect & Save'}
                onPress={handleSave}
                disabled={isSaving || !url.trim()}
                loading={isSaving}
                variant="primary"
                size="lg"
                fullWidth
                icon={
                  !isSaving ? <MaterialIcons name="check-circle" size={20} color="#FFFFFF" /> : undefined
                }
              />
            </View>
          </GlassCard>

          <Text style={styles.footer}>
            App data clear karne par URL bhi remove ho jayega
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: AuroraSpacing.md,
    justifyContent: 'center',
    paddingVertical: AuroraSpacing.xxl,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: AuroraSpacing.xl,
  },
  iconHalo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: AuroraSpacing.md,
    overflow: 'hidden',
    ...AuroraShadow.neon,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AuroraColors.glassBorder,
  },
  title: {
    fontSize: 30,
    fontWeight: AuroraFont.weight.black,
    color: AuroraColors.text,
    letterSpacing: 1.4,
    textShadowColor: AuroraColors.neonGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  subtitle: {
    fontSize: AuroraFont.size.lg,
    color: AuroraColors.textSecondary,
    fontWeight: AuroraFont.weight.bold,
    marginTop: 2,
  },
  card: {
    marginBottom: AuroraSpacing.lg,
  },
  cardTitle: {
    fontSize: AuroraFont.size.xl,
    fontWeight: AuroraFont.weight.bold,
    color: AuroraColors.text,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: AuroraFont.size.sm,
    color: AuroraColors.textSecondary,
    lineHeight: 20,
  },
  buttonWrap: {
    marginTop: AuroraSpacing.md,
  },
  footer: {
    textAlign: 'center',
    fontSize: AuroraFont.size.xs,
    color: AuroraColors.textMuted,
    marginTop: AuroraSpacing.md,
    letterSpacing: AuroraFont.tracking.wide,
  },
});
