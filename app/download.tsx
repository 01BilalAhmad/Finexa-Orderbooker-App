// Download Data Screen — Manual data download, shown before route start
// BLOCKS download if there's pending offline data (recoveries + GPS waypoints)
// User MUST upload pending data before downloading new route
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
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
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
      // Check for pending offline recoveries
      const recoveries = await StorageService.getOfflineQueue();
      const recoveryCount = recoveries?.length || 0;
      const totalAmount = recoveries?.reduce((sum: number, r: any) => sum + (r.amount || 0), 0) || 0;
      setPendingRecoveries(recoveryCount);
      setPendingAmount(totalAmount);

      // Check for pending GPS waypoints
      const locations = await StorageService.getOfflineRouteLocations();
      const waypointCount = locations?.length || 0;
      setPendingWaypoints(waypointCount);

      // Also check yesterday sync flag
      const yesterdayDone = await StorageService.isYesterdaySyncDone();

      // Has pending data if: recoveries > 0 OR waypoints > 0 OR yesterday not synced
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

      // Mark yesterday as synced
      const today = getTodayDateStr();
      await StorageService.saveLastSyncUploadDate(today);

      // Re-check pending data
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

    // Double check — no pending data allowed
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
    <View style={styles.root}>
      <LinearGradient colors={['#4F46E5', '#6366F1', '#818CF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconCircle}>
            <MaterialIcons name="cloud-download" size={56} color="#FFFFFF" />
          </View>

          <Text style={styles.title}>Download Today's Data</Text>
          <Text style={styles.date}>{getTodayLabel()}</Text>

          <Text style={styles.desc}>
            Pehle aaj ka data download karein. Data download ke baad hi route start kar sakte hain aur shops dikhengi.
          </Text>

          {/* PENDING DATA WARNING — shows upload button */}
          {hasPendingData && (
            <View style={styles.warningContainer}>
              <View style={styles.warningHeader}>
                <MaterialIcons name="warning" size={24} color="#F59E0B" />
                <Text style={styles.warningTitle}>PICHLA DATA UPLOAD KARO</Text>
              </View>

              <View style={styles.pendingList}>
                {pendingRecoveries > 0 && (
                  <View style={styles.pendingRow}>
                    <MaterialIcons name="payments" size={16} color="#FCD34D" />
                    <Text style={styles.pendingText}>
                      {pendingRecoveries} pending recoveries ({formatPKR(pendingAmount)})
                    </Text>
                  </View>
                )}
                {pendingWaypoints > 0 && (
                  <View style={styles.pendingRow}>
                    <MaterialIcons name="location-on" size={16} color="#FCD34D" />
                    <Text style={styles.pendingText}>
                      {pendingWaypoints} GPS waypoints
                    </Text>
                  </View>
                )}
                {pendingRecoveries === 0 && pendingWaypoints === 0 && (
                  <View style={styles.pendingRow}>
                    <MaterialIcons name="sync" size={16} color="#FCD34D" />
                    <Text style={styles.pendingText}>
                      Kal ka data sync nahi hua
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.warningDesc}>
                Pehle ye data upload karo, phir naya route download hoga.
              </Text>

              {/* UPLOAD BUTTON */}
              <Pressable
                style={({ pressed }) => [
                  styles.uploadBtn,
                  isUploading && styles.btnDisabled,
                  pressed && !isUploading && styles.btnPressed,
                ]}
                onPress={handleUpload}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.btnText}>Uploading...</Text>
                  </>
                ) : (
                  <>
                    <MaterialIcons name="cloud-upload" size={22} color="#FFFFFF" />
                    <Text style={styles.btnText}>Abhi Upload Karein</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* DOWNLOAD BUTTON — disabled if pending data */}
          <Pressable
            style={({ pressed }) => [
              styles.downloadBtn,
              (isDownloading || hasPendingData) && styles.btnDisabled,
              pressed && !isDownloading && !hasPendingData && styles.btnPressed,
            ]}
            onPress={handleDownload}
            disabled={isDownloading || hasPendingData}
          >
            <LinearGradient
              colors={hasPendingData ? ['#94A3B8', '#94A3B8'] : ['#4F46E5', '#6366F1']}
              style={styles.btnGradient}
            >
              {isDownloading ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.btnText}>Downloading...</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="download" size={24} color="#FFFFFF" />
                  <Text style={styles.btnText}>
                    {hasPendingData ? 'Download Locked' : 'Download Data'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          <Text style={styles.footer}>
            {hasPendingData
              ? '⚠️ Pehle pending data upload karein'
              : 'WiFi ya Mobile Data ON hona chahiye'
            }
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#4F46E5' },
  gradient: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl },
  iconCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  title: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', letterSpacing: 0.5 },
  date: { fontSize: FontSize.lg, color: 'rgba(255,255,255,0.8)', fontWeight: FontWeight.bold, marginTop: 2 },
  desc: { fontSize: FontSize.base, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: Spacing.md, lineHeight: 22, marginBottom: Spacing.lg },

  // Warning container (pending data)
  warningContainer: {
    width: '100%',
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: 'rgba(245,158,11,0.5)',
  },
  warningHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  warningTitle: {
    fontSize: FontSize.base, fontWeight: '900', color: '#FCD34D', letterSpacing: 0.5,
  },
  pendingList: {
    marginBottom: Spacing.sm,
  },
  pendingRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingVertical: 4,
  },
  pendingText: {
    fontSize: FontSize.sm, color: '#FEF3C7', fontWeight: FontWeight.medium,
  },
  warningDesc: {
    fontSize: FontSize.xs, color: 'rgba(252,211,77,0.8)', marginBottom: Spacing.md,
    fontStyle: 'italic',
  },

  // Upload button
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: '#F59E0B', borderRadius: 12, paddingVertical: 14,
    ...Shadow.md,
  },
  btnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#FFFFFF' },

  // Download button
  downloadBtn: { borderRadius: 16, overflow: 'hidden', width: '100%', ...Shadow.xl },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 18 },
  btnDisabled: { opacity: 0.6 },
  btnPressed: { opacity: 0.85 },
  footer: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: Spacing.md },
});
