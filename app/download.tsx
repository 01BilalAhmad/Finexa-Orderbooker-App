// ═══════════════════════════════════════════════════════════════════════════
//  Aurora Glass — Download Data Screen
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
import { useShops } from '@/hooks/useShops';
import { StorageService } from '@/services/storage';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
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
import { getTodayDateStr, getTodayLabel, formatPKR } from '@/utils/format';

export default function DownloadScreen() {
  const { user } = useAuth();
  const { triggerFullSync } = useShops();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingRecoveries, setPendingRecoveries] = useState(0);
  const [pendingWaypoints, setPendingWaypoints] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [hasPendingData, setHasPendingData] = useState(false);

  useEffect(() => {
    checkPendingData();
  }, []);

  async function checkPendingData() {
    try {
      const recoveries = await StorageService.getOfflineQueue();
      const recoveryCount = recoveries?.length || 0;
      const totalAmount = recoveries?.reduce((sum: number, r: any) => sum + (r.amount || 0), 0) || 0;
      setPendingRecoveries(recoveryCount);
      setPendingAmount(totalAmount);

      const locations = await StorageService.getOfflineRouteLocations();
      const waypointCount = locations?.length || 0;
      setPendingWaypoints(waypointCount);

      const yesterdayDone = await StorageService.isYesterdaySyncDone();
      const pending = recoveryCount > 0 || waypointCount > 0 || !yesterdayDone;
      setHasPendingData(pending);
    } catch (e) {
      console.warn('[Download] Failed to check pending data:', e);
    }
  }

  async function handleUpload() {
    if (!user) return;
    setIsUploading(true);
    try {
      const { performSyncUpload } = await import('@/services/syncUpload');
      const result = await performSyncUpload();
      console.log('[Download] Sync upload result:', result);

      const today = getTodayDateStr();
      await StorageService.saveLastSyncUploadDate(today);
      await checkPendingData();

      if (hasPendingData) {
        Alert.alert(
          'Upload Complete!',
          `Data upload ho gaya!\n\nRecoveries: ${result.transactionsSynced}\nWaypoints: ${result.locationsUploaded}\n\nAb naya data download kar sakte hain.`,
          [{ text: 'OK' }]
        );
      }
    } catch (e: any) {
      Alert.alert(
        'Upload Failed',
        'Data upload nahi ho saka. Internet check karein aur dobara try karein.\n\nError: ' + (e.message || 'Unknown'),
        [{ text: 'OK' }]
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownload() {
    if (!user) return;

    if (hasPendingData) {
      Alert.alert(
        'Pehle Upload Karein!',
        'Aap ke paas pending data hai jo upload nahi hua. Pehle "Upload Pending Data" button dabayein, phir download kar sakte hain.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsDownloading(true);
    try {
      const ok = await triggerFullSync(user.id, !!user.allRoutesEnabled);
      if (ok) {
        const today = getTodayDateStr();
        await StorageService.saveDataDownloadedDate(today);
        await StorageService.saveDataDownloadedForDate(today);
        Alert.alert('Download Complete', 'Aaj ka data download ho gaya! Ab route start karein.');
        setTimeout(() => {
          router.replace('/route-start');
        }, 100);
      } else {
        Alert.alert('Download Failed', 'Data download nahi ho saka. Internet check karein aur dobara try karein.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <AuroraBackground topTint={AuroraColors.bgVoid}>
      <View style={styles.content}>
        {/* Icon with neon halo */}
        <View style={styles.iconHalo}>
          <LinearGradient
            colors={['rgba(99, 102, 241, 0.35)', 'rgba(167, 139, 250, 0.20)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.iconCircle}>
            <MaterialIcons name="cloud-download" size={56} color={AuroraColors.neonViolet} />
          </View>
        </View>

        <Text style={styles.title}>Download Today&apos;s Data</Text>
        <Text style={styles.date}>{getTodayLabel()}</Text>

        <Text style={styles.desc}>
          Pehle aaj ka data download karein. Data download ke baad hi route start kar sakte hain aur shops dikhengi.
        </Text>

        {/* PENDING DATA WARNING */}
        {hasPendingData ? (
          <GlassCard variant="base" padding="lg" radius="lg" glow="warning" style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <View style={styles.warningIconBox}>
                <MaterialIcons name="warning" size={22} color={AuroraColors.warning} />
              </View>
              <Text style={styles.warningTitle}>PICHLA DATA UPLOAD KARO</Text>
            </View>

            <View style={styles.pendingList}>
              {pendingRecoveries > 0 ? (
                <View style={styles.pendingRow}>
                  <MaterialIcons name="payments" size={16} color={AuroraColors.warning} />
                  <Text style={styles.pendingText}>
                    {pendingRecoveries} pending recoveries ({formatPKR(pendingAmount)})
                  </Text>
                </View>
              ) : null}
              {pendingWaypoints > 0 ? (
                <View style={styles.pendingRow}>
                  <MaterialIcons name="location-on" size={16} color={AuroraColors.warning} />
                  <Text style={styles.pendingText}>
                    {pendingWaypoints} GPS waypoints
                  </Text>
                </View>
              ) : null}
              {pendingRecoveries === 0 && pendingWaypoints === 0 ? (
                <View style={styles.pendingRow}>
                  <MaterialIcons name="sync" size={16} color={AuroraColors.warning} />
                  <Text style={styles.pendingText}>
                    Kal ka data sync nahi hua
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.warningDesc}>
              Pehle ye data upload karo, phir naya route download hoga.
            </Text>

            <View style={styles.buttonWrap}>
              <NeonButton
                label={isUploading ? 'Uploading...' : 'Abhi Upload Karein'}
                onPress={handleUpload}
                disabled={isUploading}
                loading={isUploading}
                variant="ghost"
                size="md"
                fullWidth
                icon={
                  !isUploading ? <MaterialIcons name="cloud-upload" size={20} color="#FFFFFF" /> : undefined
                }
              />
            </View>
          </GlassCard>
        ) : null}

        <View style={styles.buttonWrap}>
          <NeonButton
            label={
              isDownloading
                ? 'Downloading...'
                : hasPendingData
                ? 'Download Locked'
                : 'Download Data'
            }
            onPress={handleDownload}
            disabled={isDownloading || hasPendingData}
            loading={isDownloading}
            variant={hasPendingData ? 'subtle' : 'primary'}
            size="lg"
            fullWidth
            icon={
              !isDownloading && !hasPendingData
                ? <MaterialIcons name="download" size={22} color="#FFFFFF" />
                : undefined
            }
          />
        </View>

        <Text style={styles.footer}>
          {hasPendingData
            ? 'Pehle pending data upload karein'
            : 'WiFi ya Mobile Data ON hona chahiye'
          }
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
    fontSize: 28,
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
    marginBottom: AuroraSpacing.lg,
  },
  warningCard: {
    width: '100%',
    marginBottom: AuroraSpacing.lg,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AuroraSpacing.sm,
    marginBottom: AuroraSpacing.sm,
  },
  warningIconBox: {
    width: 36,
    height: 36,
    borderRadius: AuroraRadius.sm,
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningTitle: {
    fontSize: AuroraFont.size.base,
    fontWeight: AuroraFont.weight.bold,
    color: AuroraColors.warning,
    letterSpacing: 0.5,
  },
  pendingList: {
    marginBottom: AuroraSpacing.sm,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AuroraSpacing.xs,
    paddingVertical: 4,
  },
  pendingText: {
    fontSize: AuroraFont.size.sm,
    color: 'rgba(251, 191, 36, 0.85)',
    fontWeight: AuroraFont.weight.medium,
  },
  warningDesc: {
    fontSize: AuroraFont.size.xs,
    color: 'rgba(251, 191, 36, 0.65)',
    marginBottom: AuroraSpacing.md,
    fontStyle: 'italic',
  },
  buttonWrap: {
    width: '100%',
    marginTop: AuroraSpacing.sm,
  },
  footer: {
    fontSize: AuroraFont.size.xs,
    color: AuroraColors.textMuted,
    marginTop: AuroraSpacing.md,
    textAlign: 'center',
    letterSpacing: AuroraFont.tracking.wide,
  },
});
