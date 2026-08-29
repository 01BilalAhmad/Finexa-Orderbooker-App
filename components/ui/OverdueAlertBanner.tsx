// components/ui/OverdueAlertBanner.tsx
// Red alert banner shown on dashboard when there are overdue shops.
// Tapping it navigates to the full Overdue page (app/overdue.tsx)
// instead of opening a modal — matches mockup data-screen="overdue".
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { AuroraColors } from '@/constants/auroraTheme';
import { formatPKR } from '@/utils/format';
import { OverdueShop } from '@/services/storage';
import { getCachedOverdueShops } from '@/utils/overdueCalculator';

export function OverdueAlertBanner() {
  const [overdueShops, setOverdueShops] = useState<OverdueShop[]>([]);

  const fetchOverdue = useCallback(async () => {
    const shops = await getCachedOverdueShops();
    setOverdueShops(shops);
  }, []);

  useEffect(() => {
    fetchOverdue();
    // Refresh every 60 seconds
    const interval = setInterval(fetchOverdue, 60000);
    return () => clearInterval(interval);
  }, [fetchOverdue]);

  if (overdueShops.length === 0) return null;

  const totalPending = overdueShops.reduce((sum, s) => sum + s.balance, 0);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/overdue');
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.banner, pressed && { opacity: 0.92 }]}
      onPress={handlePress}
    >
      <LinearGradient
        colors={[AuroraColors.rose600, AuroraColors.rose500, AuroraColors.rose400]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.bannerLeft}>
        <View style={styles.iconWrap}>
          <MaterialIcons name="warning" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.bannerText}>
          <Text style={styles.bannerTitle}>
            {overdueShops.length} Overdue Shops
          </Text>
          <Text style={styles.bannerSubtitle}>
            {formatPKR(totalPending)} pending recovery
          </Text>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={22} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    // Soft rose-tinted shadow
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 4,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bannerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
});
