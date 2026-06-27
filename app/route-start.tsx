// Route Start Screen — Show after data download, before showing shops
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
import { Colors, Spacing, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { getTodayLabel } from '@/utils/format';

export default function RouteStartScreen() {
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
              // where route tracking state hasn't updated yet when router.replace('/') fires
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
    <View style={styles.root}>
      <LinearGradient colors={['#10B981', '#059669', '#047857']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconCircle}>
            <MaterialIcons name="play-circle-fill" size={56} color="#FFFFFF" />
          </View>

          <Text style={styles.title}>Start Your Route</Text>
          <Text style={styles.date}>{getTodayLabel()}</Text>

          <Text style={styles.desc}>
            Data download ho gaya hai! Ab route start karein. Route start ke baad:
          </Text>

          <View style={styles.features}>
            <View style={styles.featureRow}>
              <MaterialIcons name="store" size={20} color="#A7F3D0" />
              <Text style={styles.featureText}>Shops list dikhegi</Text>
            </View>
            <View style={styles.featureRow}>
              <MaterialIcons name="my-location" size={20} color="#A7F3D0" />
              <Text style={styles.featureText}>GPS tracking shuru hoga</Text>
            </View>
            <View style={styles.featureRow}>
              <MaterialIcons name="offline-bolt" size={20} color="#A7F3D0" />
              <Text style={styles.featureText}>Offline recovery kaam karegi</Text>
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <MaterialIcons name="error" size={20} color="#FCA5A5" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.startBtn,
              isLoading && styles.startBtnDisabled,
              pressed && !isLoading && styles.startBtnPressed,
            ]}
            onPress={handleStartRoute}
            disabled={isLoading}
          >
            <LinearGradient colors={['#FFFFFF', '#F0FDF4']} style={styles.btnGradient}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#059669" />
              ) : (
                <>
                  <MaterialIcons name="route" size={24} color="#059669" />
                  <Text style={styles.btnText}>Start Route</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          {resumableSessionId ? (
            <Pressable
              style={({ pressed }) => [
                styles.summaryBtn,
                pressed && styles.summaryBtnPressed,
              ]}
              onPress={handleViewSummary}
            >
              <MaterialIcons name="history" size={18} color="#A7F3D0" />
              <Text style={styles.summaryBtnText}>View Last Route Summary / Resume</Text>
            </Pressable>
          ) : null}

          <Text style={styles.footer}>
            Route start hone ke baad GPS har 30 sec mein location save karega
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#10B981' },
  gradient: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl },
  iconCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
  date: { fontSize: FontSize.lg, color: 'rgba(255,255,255,0.8)', fontWeight: FontWeight.bold, marginTop: 2 },
  desc: { fontSize: FontSize.base, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: Spacing.md, lineHeight: 22 },
  features: { marginTop: Spacing.lg, marginBottom: Spacing.xl, width: '100%' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  featureText: { fontSize: FontSize.base, color: 'rgba(255,255,255,0.9)', fontWeight: FontWeight.semibold },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.2)', borderRadius: 12,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)',
  },
  errorText: { fontSize: FontSize.sm, color: '#FCA5A5', flex: 1 },
  startBtn: { borderRadius: 16, overflow: 'hidden', width: '100%', ...Shadow.xl },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 18 },
  startBtnDisabled: { opacity: 0.5 },
  startBtnPressed: { opacity: 0.85 },
  btnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#059669' },
  summaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    marginTop: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  summaryBtnPressed: { opacity: 0.7 },
  summaryBtnText: { fontSize: FontSize.sm, color: '#A7F3D0', fontWeight: FontWeight.semibold },
  footer: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: Spacing.md, textAlign: 'center' },
});
