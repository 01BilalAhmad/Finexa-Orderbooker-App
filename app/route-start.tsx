// ═══════════════════════════════════════════════════════════════════════════
//  Aurora Glass — Route Start Screen
//  Premium glassmorphic design with neon indigo gradient backdrop
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useRouteTracking } from '@/contexts/RouteTrackingContext';
import { StorageService } from '@/services/storage';
import { Spacing, FontSize, FontWeight, Shadow } from '@/constants/theme';
import {
  AuroraBackground,
  GlassCard,
  NeonButton,
  AuroraColors,
  AuroraGradients,
  AuroraRadius,
  AuroraSpacing,
  AuroraFont,
  AuroraShadow,
} from '@/components/aurora';
import { getTodayLabel } from '@/utils/format';

export default function RouteStartScreen() {
  const { user } = useAuth();
  const { startRoute, isStarting, error, lastEndedSessionId } = useRouteTracking();
  const [isStartingLocal, setIsStartingLocal] = useState(false);
  const [resumableSessionId, setResumableSessionId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sid = await StorageService.getResumableSessionId();
        setResumableSessionId(sid || lastEndedSessionId);
      } catch {}
    })();
  }, [lastEndedSessionId]);

  async function handleStartRoute() {
    if (!user) return;

    Alert.alert(
      'Start Route',
      'Kya aaj ka route start karna hai? Route start ke baad GPS tracking shuru ho jayega.',
      [
        { text: 'Nahi', style: 'cancel' },
        {
          text: 'Haan, Start!',
          onPress: async () => {
            setIsStartingLocal(true);
            try {
              await startRoute();
              setTimeout(() => {
                router.replace('/(tabs)');
              }, 100);
            } catch (e: any) {
              console.error('[RouteStart] startRoute failed:', e);
              Alert.alert('Error', e.message || 'Route start nahi ho saka. Dobarra try karein.');
            } finally {
              setIsStartingLocal(false);
            }
          },
        },
      ]
    );
  }

  function handleViewSummary() {
    router.push('/route-summary');
  }

  const isLoading = isStarting || isStartingLocal;

  return (
    <AuroraBackground topTint={AuroraColors.bgVoid}>
      <View style={styles.content}>
        {/* Icon with neon halo */}
        <View style={styles.iconHalo}>
          <LinearGradient
            colors={['rgba(52, 211, 153, 0.30)', 'rgba(99, 102, 241, 0.20)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.iconCircle}>
            <MaterialIcons name="play-circle-fill" size={56} color={AuroraColors.success} />
          </View>
        </View>

        <Text style={styles.title}>Start Your Route</Text>
        <Text style={styles.date}>{getTodayLabel()}</Text>

        <Text style={styles.desc}>
          Data download ho gaya hai! Ab route start karein. Route start ke baad:
        </Text>

        <GlassCard variant="base" padding="lg" radius="lg" style={styles.featuresCard}>
          <View style={styles.featureRow}>
            <View style={styles.featureIconBox}>
              <MaterialIcons name="store" size={18} color={AuroraColors.neonViolet} />
            </View>
            <Text style={styles.featureText}>Shops list dikhegi</Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.featureIconBox}>
              <MaterialIcons name="my-location" size={18} color={AuroraColors.neonViolet} />
            </View>
            <Text style={styles.featureText}>GPS tracking shuru hoga</Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.featureIconBox}>
              <MaterialIcons name="offline-bolt" size={18} color={AuroraColors.neonViolet} />
            </View>
            <Text style={styles.featureText}>Offline recovery kaam karegi</Text>
          </View>
        </GlassCard>

        {error ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error" size={20} color={AuroraColors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.buttonWrap}>
          <NeonButton
            label={isLoading ? 'Starting...' : 'Start Route'}
            onPress={handleStartRoute}
            disabled={isLoading}
            loading={isLoading}
            variant="success"
            size="lg"
            fullWidth
            icon={
              !isLoading ? <MaterialIcons name="route" size={22} color="#FFFFFF" /> : undefined
            }
          />
        </View>

        {resumableSessionId ? (
          <Pressable
            style={({ pressed }) => [
              styles.summaryBtn,
              pressed && { opacity: 0.7 },
            ]}
            onPress={handleViewSummary}
          >
            <MaterialIcons name="history" size={18} color={AuroraColors.neonViolet} />
            <Text style={styles.summaryBtnText}>View Last Route Summary / Resume</Text>
          </Pressable>
        ) : null}

        <Text style={styles.footer}>
          Route start hone ke baad GPS har 30 sec mein location save karega
        </Text>
      </View>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: AuroraSpacing.xl,
  },
  iconHalo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: AuroraSpacing.xl,
    overflow: 'hidden',
    ...AuroraShadow.neon,
  },
  iconCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
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
    textAlign: 'center',
    letterSpacing: 1.2,
    textShadowColor: AuroraColors.neonGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  date: {
    fontSize: AuroraFont.size.lg,
    color: AuroraColors.textSecondary,
    fontWeight: AuroraFont.weight.bold,
    marginTop: 4,
  },
  desc: {
    fontSize: AuroraFont.size.base,
    color: AuroraColors.textSecondary,
    textAlign: 'center',
    marginTop: AuroraSpacing.md,
    lineHeight: 22,
  },
  featuresCard: {
    marginTop: AuroraSpacing.lg,
    marginBottom: AuroraSpacing.lg,
    width: '100%',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AuroraSpacing.sm,
    marginBottom: AuroraSpacing.sm,
  },
  featureIconBox: {
    width: 36,
    height: 36,
    borderRadius: AuroraRadius.sm,
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: AuroraFont.size.base,
    color: AuroraColors.text,
    fontWeight: AuroraFont.weight.semibold,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AuroraSpacing.sm,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderRadius: AuroraRadius.md,
    paddingHorizontal: AuroraSpacing.md,
    paddingVertical: AuroraSpacing.sm,
    marginBottom: AuroraSpacing.md,
    marginTop: AuroraSpacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.30)',
  },
  errorText: {
    fontSize: AuroraFont.size.sm,
    color: AuroraColors.danger,
    flex: 1,
    fontWeight: AuroraFont.weight.semibold,
  },
  buttonWrap: {
    width: '100%',
    marginTop: AuroraSpacing.sm,
  },
  summaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AuroraSpacing.sm,
    marginTop: AuroraSpacing.md,
    paddingVertical: AuroraSpacing.sm,
    paddingHorizontal: AuroraSpacing.md,
    borderRadius: AuroraRadius.md,
    borderWidth: 1,
    borderColor: AuroraColors.glassBorder,
    backgroundColor: AuroraColors.glassBase,
  },
  summaryBtnText: {
    fontSize: AuroraFont.size.sm,
    color: AuroraColors.neonViolet,
    fontWeight: AuroraFont.weight.semibold,
  },
  footer: {
    fontSize: AuroraFont.size.xs,
    color: AuroraColors.textMuted,
    marginTop: AuroraSpacing.md,
    textAlign: 'center',
    letterSpacing: AuroraFont.tracking.wide,
  },
});
