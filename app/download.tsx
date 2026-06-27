// Download Data Screen — Manual data download, shown before route start
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
import { getTodayDateStr, getTodayLabel } from '@/utils/format';

export default function DownloadScreen() {
  const { user } = useAuth();
  const { triggerFullSync } = useShops();
  const [isDownloading, setIsDownloading] = useState(false);
  const [yesterdaySyncPending, setYesterdaySyncPending] = useState(false);

  useEffect(() => {
    checkYesterdaySync();
  }, []);

  async function checkYesterdaySync() {
    const done = await StorageService.isYesterdaySyncDone();
    setYesterdaySyncPending(!done);
  }

  async function handleDownload() {
    if (!user) return;

    // Double check yesterday's sync
    const yesterdayDone = await StorageService.isYesterdaySyncDone();
    if (!yesterdayDone) {
      Alert.alert(
        'Sync Pending!',
        'Pehle kal ka data sync upload karein! Jab tak purana data upload nahi hoga, naya download nahi hoga.',
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
        // Navigate directly to route-start — avoids race condition with root router
        // where AsyncStorage data hasn't been read yet when router.replace('/') fires
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

          {yesterdaySyncPending && (
            <View style={styles.warningBox}>
              <MaterialIcons name="warning" size={20} color="#F59E0B" />
              <Text style={styles.warningText}>
                Kal ka data sync nahi hua! Pehle wo upload karein.
              </Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.downloadBtn,
              (isDownloading || yesterdaySyncPending) && styles.downloadBtnDisabled,
              pressed && !isDownloading && styles.downloadBtnPressed,
            ]}
            onPress={handleDownload}
            disabled={isDownloading || yesterdaySyncPending}
          >
            <LinearGradient colors={['#4F46E5', '#6366F1']} style={styles.btnGradient}>
              {isDownloading ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.btnText}>Downloading...</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="download" size={24} color="#FFFFFF" />
                  <Text style={styles.btnText}>Download Data</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          <Text style={styles.footer}>
            WiFi ya Mobile Data ON hona chahiye
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
  warningBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(245,158,11,0.2)', borderRadius: 12,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg, borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)',
  },
  warningText: { fontSize: FontSize.sm, color: '#FCD34D', flex: 1 },
  downloadBtn: { borderRadius: 16, overflow: 'hidden', width: '100%', ...Shadow.xl },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 18 },
  downloadBtnDisabled: { opacity: 0.5 },
  downloadBtnPressed: { opacity: 0.85 },
  btnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF' },
  footer: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: Spacing.md },
});
