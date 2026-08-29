// =================================================================
// AURORA GLASS — ROUTE START SCREEN
// • Brand gradient hero (indigo→violet→indigo)
// • Glassmorphic feature list on light body
// • NeonButton for primary CTA, ghost variant for summary link
// =================================================================
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useRouteTracking } from '@/contexts/RouteTrackingContext';
import { StorageService } from '@/services/storage';
import { AuroraBackground, GlassCard, NeonButton } from '@/components/aurora';
import {
  AuroraColors,
  AuroraFont,
  AuroraRadius,
  AuroraShadow,
  AuroraGradients,
} from '@/constants/auroraTheme';
import { getTodayLabel } from '@/utils/format';

export default function RouteStartScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { startRoute, isStarting, error, lastEndedSessionId } = useRouteTracking();
  const [isStartingLocal, setIsStartingLocal] = useState(false);
  const [resumableSessionId, setResumableSessionId] = useState<string | null>(null);

  // On mount, check if there's a resumable (ended today) session
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
              // Navigate directly to tabs — avoids race condition with root router
              setTimeout(() => {
                router.replace('/(tabs)');
              }, 100);
            } catch (e: any) {
              console.error('[RouteStart] startRoute failed:', e);
              Alert.alert(
                'Error',
                e.message || 'Route start nahi ho saka. Dobarra try karein.'
              );
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
    <AuroraBackground style={styles.root}>
      {/* Hero gradient at top */}
      <LinearGradient
        colors={[
          AuroraGradients.brandStart,
          AuroraGradients.brandMid,
          AuroraGradients.brandEnd,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.heroBg]}
      />

      {/* Floating glassmorphic icon */}
      <View style={styles.iconCircleWrap}>
        <View style={styles.iconCircle}>
          <MaterialIcons name="play-circle-fill" size={48} color={AuroraColors.textInverse} />
        </View>
      </View>

      <View
        style={[
          styles.body,
          {
            paddingTop: insets.top + 140,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <Text style={styles.title}>Start Your Route</Text>
        <Text style={styles.date}>{getTodayLabel()}</Text>

        <Text style={styles.desc}>
          Data download ho gaya hai! Ab route start karein. Route start ke baad:
        </Text>

        <GlassCard glow="brand" padding="lg" style={styles.featuresCard}>
          <View style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <MaterialIcons name="store" size={18} color={AuroraColors.indigo600} />
            </View>
            <Text style={styles.featureText}>Shops list dikhegi</Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <MaterialIcons name="my-location" size={18} color={AuroraColors.indigo600} />
            </View>
            <Text style={styles.featureText}>GPS tracking shuru hoga</Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <MaterialIcons name="offline-bolt" size={18} color={AuroraColors.indigo600} />
            </View>
            <Text style={styles.featureText}>Offline recovery kaam karegi</Text>
          </View>
        </GlassCard>

        {error && (
          <View style={styles.errorBox}>
            <MaterialIcons name="error" size={20} color={AuroraColors.rose500} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.ctaWrap}>
          <NeonButton
            label={isLoading ? 'Starting...' : 'Start Route'}
            onPress={handleStartRoute}
            loading={isLoading}
            disabled={isLoading}
            icon={
              !isLoading && (
                <MaterialIcons name="route" size={24} color={AuroraColors.textInverse} />
              )
            }
            style={styles.ctaBtn}
          />
        </View>

        {resumableSessionId ? (
          <Pressable
            style={({ pressed }) => [styles.summaryBtn, pressed && styles.summaryBtnPressed]}
            onPress={handleViewSummary}
          >
            <MaterialIcons name="history" size={18} color={AuroraColors.indigo600} />
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
  root: {
    flex: 1,
  },
  heroBg: {
    height: 320,
    borderBottomLeftRadius: AuroraRadius.r2xl,
    borderBottomRightRadius: AuroraRadius.r2xl,
  },
  iconCircleWrap: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 26,
    backgroundColor: AuroraColors.glassOnGradient,
    borderWidth: 1,
    borderColor: AuroraColors.glassOnGradientBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...AuroraShadow.lg,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    fontFamily: AuroraFont.display,
    fontSize: 28,
    fontWeight: AuroraFont.extrabold as any,
    color: AuroraColors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  date: {
    fontFamily: AuroraFont.sans,
    fontSize: AuroraFont.fsLg, // 18
    color: AuroraColors.indigo600,
    fontWeight: AuroraFont.bold as any,
    marginTop: 2,
  },
  desc: {
    fontFamily: AuroraFont.sans,
    fontSize: AuroraFont.fsBase, // 15
    color: AuroraColors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
    marginBottom: 16,
  },
  // ── Features glass card ──
  featuresCard: {
    width: '100%',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: AuroraColors.indigo50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: AuroraFont.fsBase, // 15
    color: AuroraColors.textPrimary,
    fontWeight: AuroraFont.medium as any,
    fontFamily: AuroraFont.sans,
  },
  // ── Error box ──
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: AuroraColors.roseLight,
    borderWidth: 1,
    borderColor: AuroraColors.roseBorder,
    borderRadius: AuroraRadius.rMd,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    width: '100%',
  },
  errorText: {
    flex: 1,
    fontSize: AuroraFont.fsSm, // 13
    color: AuroraColors.rose600,
    fontFamily: AuroraFont.sans,
    fontWeight: AuroraFont.medium as any,
  },
  // ── CTA ──
  ctaWrap: {
    width: '100%',
    marginTop: 4,
  },
  ctaBtn: {
    minHeight: 54,
  },
  // ── Summary ghost button ──
  summaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: AuroraRadius.rMd,
    borderWidth: 1,
    borderColor: AuroraColors.borderDefault,
    backgroundColor: 'transparent',
  },
  summaryBtnPressed: {
    opacity: 0.7,
  },
  summaryBtnText: {
    fontSize: AuroraFont.fsSm, // 13
    color: AuroraColors.indigo600,
    fontWeight: AuroraFont.semibold as any,
    fontFamily: AuroraFont.sans,
  },
  footer: {
    fontFamily: AuroraFont.sans,
    fontSize: AuroraFont.fsXs, // 11
    color: AuroraColors.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },
});
