// =================================================================
// AURORA GLASS — DOWNLOAD SCREEN
// • Brand gradient hero (indigo→violet→indigo)
// • Glassmorphic content card on slate-50 body
// • GlassInput-less but uses NeonButton for primary CTAs
// • AuroraBackground floating orbs
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
import { useShops } from '@/hooks/useShops';
import { StorageService } from '@/services/storage';
import { AuroraBackground, GlassCard, NeonButton } from '@/components/aurora';
import {
  AuroraColors,
  AuroraFont,
  AuroraRadius,
  AuroraShadow,
  AuroraGradients,
} from '@/constants/auroraTheme';
import { getTodayDateStr, getTodayLabel, formatPKR } from '@/utils/format';

export default function DownloadScreen() {
  const insets = useSafeAreaInsets();
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
      const totalAmount = recoveries?.reduce(
        (sum: number, r: any) => sum + (r.amount || 0),
        0
      ) || 0;
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
        'Data upload nahi ho saka. Internet check karein aur dobara try karein.\n\nError: ' +
          (e.message || 'Unknown'),
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
        '⚠️ Pehle Upload Karein!',
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
        Alert.alert(
          'Download Complete',
          'Aaj ka data download ho gaya! Ab route start karein.'
        );
        setTimeout(() => {
          router.replace('/route-start');
        }, 100);
      } else {
        Alert.alert(
          'Download Failed',
          'Data download nahi ho saka. Internet check karein aur dobara try karein.'
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <AuroraBackground style={styles.root}>
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
          <MaterialIcons name="cloud-download" size={48} color={AuroraColors.textInverse} />
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
        <Text style={styles.title}>Download Today&apos;s Data</Text>
        <Text style={styles.date}>{getTodayLabel()}</Text>
        <Text style={styles.desc}>
          Pehle aaj ka data download karein. Data download ke baad hi route start kar sakte
          hain aur shops dikhengi.
        </Text>

        {/* Pending data warning */}
        {hasPendingData && (
          <GlassCard glow="default" padding="md" style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <MaterialIcons name="warning" size={22} color={AuroraColors.amber500} />
              <Text style={styles.warningTitle}>PICHLA DATA UPLOAD KARO</Text>
            </View>

            <View style={styles.pendingList}>
              {pendingRecoveries > 0 && (
                <View style={styles.pendingRow}>
                  <MaterialIcons name="payments" size={16} color={AuroraColors.amber600} />
                  <Text style={styles.pendingText}>
                    {pendingRecoveries} pending recoveries ({formatPKR(pendingAmount)})
                  </Text>
                </View>
              )}
              {pendingWaypoints > 0 && (
                <View style={styles.pendingRow}>
                  <MaterialIcons name="location-on" size={16} color={AuroraColors.amber600} />
                  <Text style={styles.pendingText}>{pendingWaypoints} GPS waypoints</Text>
                </View>
              )}
              {pendingRecoveries === 0 && pendingWaypoints === 0 && (
                <View style={styles.pendingRow}>
                  <MaterialIcons name="sync" size={16} color={AuroraColors.amber600} />
                  <Text style={styles.pendingText}>Kal ka data sync nahi hua</Text>
                </View>
              )}
            </View>

            <Text style={styles.warningDesc}>
              Pehle ye data upload karo, phir naya route download hoga.
            </Text>

            <View style={styles.uploadBtnWrap}>
              <NeonButton
                label={isUploading ? 'Uploading...' : 'Abhi Upload Karein'}
                variant="danger"
                onPress={handleUpload}
                loading={isUploading}
                disabled={isUploading}
                icon={
                  !isUploading && (
                    <MaterialIcons name="cloud-upload" size={20} color={AuroraColors.textInverse} />
                  )
                }
              />
            </View>
          </GlassCard>
        )}

        {/* Download CTA */}
        <View style={styles.downloadBtnWrap}>
          <NeonButton
            label={
              isDownloading
                ? 'Downloading...'
                : hasPendingData
                ? 'Download Locked'
                : 'Download Data'
            }
            onPress={handleDownload}
            loading={isDownloading}
            disabled={isDownloading || hasPendingData}
            icon={
              !isDownloading && (
                <MaterialIcons name="download" size={22} color={AuroraColors.textInverse} />
              )
            }
            style={styles.ctaBtn}
          />
        </View>

        <Text style={styles.footer}>
          {hasPendingData
            ? '⚠️ Pehle pending data upload karein'
            : 'WiFi ya Mobile Data ON hona chahiye'}
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
    fontSize: 26,
    fontWeight: AuroraFont.extrabold as any,
    color: AuroraColors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  date: {
    fontFamily: AuroraFont.sans,
    fontSize: AuroraFont.fsLg, // 18
    color: AuroraColors.indigo600,
    fontWeight: AuroraFont.bold as any,
  },
  desc: {
    fontFamily: AuroraFont.sans,
    fontSize: AuroraFont.fsBase, // 15
    color: AuroraColors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
    marginBottom: 20,
  },
  // ── Pending data warning card ──
  warningCard: {
    width: '100%',
    marginBottom: 16,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  warningTitle: {
    fontSize: AuroraFont.fsBase, // 15
    fontWeight: AuroraFont.extrabold as any,
    color: AuroraColors.amber600,
    letterSpacing: 0.5,
    fontFamily: AuroraFont.sans,
  },
  pendingList: {
    marginBottom: 8,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  pendingText: {
    fontSize: AuroraFont.fsSm, // 13
    color: AuroraColors.textSecondary,
    fontWeight: AuroraFont.medium as any,
    fontFamily: AuroraFont.sans,
  },
  warningDesc: {
    fontSize: AuroraFont.fsXs, // 11
    color: AuroraColors.textMuted,
    marginBottom: 14,
    fontStyle: 'italic',
    fontFamily: AuroraFont.sans,
  },
  uploadBtnWrap: {
    marginTop: 4,
  },
  // ── Download CTA ──
  downloadBtnWrap: {
    width: '100%',
    marginTop: 8,
  },
  ctaBtn: {
    minHeight: 54,
  },
  footer: {
    fontFamily: AuroraFont.sans,
    fontSize: AuroraFont.fsXs, // 11
    color: AuroraColors.textMuted,
    marginTop: 16,
    textAlign: 'center',
  },
});
