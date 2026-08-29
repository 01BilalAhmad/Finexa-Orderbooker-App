// Powered by Finexa
// Root Router — Determines which screen to show based on app state
// Flow: URL Setup → Login → Download → Route Start → Shops (Tabs)
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useRouteTracking } from '@/contexts/RouteTrackingContext';
import { StorageService } from '@/services/storage';
import { getTodayDateStr } from '@/utils/format';
import { AuroraBackground } from '@/components/aurora';
import { AuroraColors, AuroraFont } from '@/constants/auroraTheme';

type AppStep = 'loading' | 'need_url' | 'need_login' | 'need_download' | 'need_route_start' | 'ready';

export default function Index() {
  const { user, isLoading, isUrlSet } = useAuth();
  const { isTracking } = useRouteTracking();
  const [step, setStep] = useState<AppStep>('loading');
  const isEvaluating = useRef(false);

  // CRITICAL FIX: Always read from AsyncStorage directly instead of relying
  // solely on React state. This prevents race conditions where router.replace('/')
  // is called before React state has updated, causing stale closure issues.
  const determineStep = useCallback(async () => {
    // Prevent concurrent evaluations
    if (isEvaluating.current) return;
    isEvaluating.current = true;

    try {
      // Always read isLoading from React state (it's synchronous and reliable)
      if (isLoading) {
        setStep('loading');
        return;
      }

      // Step 1: Check if URL is configured — read from AsyncStorage directly
      // This avoids stale closure where isUrlSet hasn't updated yet
      const customUrl = await StorageService.getCustomApiUrl();
      const urlConfigured = !!(customUrl || isUrlSet);

      if (!urlConfigured) {
        setStep('need_url');
        return;
      }

      // Step 2: Check if logged in — read from AsyncStorage directly
      const savedUser = await StorageService.getUser();
      const savedToken = await StorageService.getToken();
      const loggedIn = !!(savedUser && savedToken) || !!user;

      if (!loggedIn) {
        setStep('need_login');
        return;
      }

      // Step 3: Check if today's data is downloaded
      const today = getTodayDateStr();
      const downloadedDate = await StorageService.getDataDownloadedDate();

      if (downloadedDate !== today) {
        // Check if yesterday's sync is done
        const yesterdaySyncDone = await StorageService.isYesterdaySyncDone();
        if (!yesterdaySyncDone) {
          // Yesterday's data not synced — BLOCK download
          Alert.alert(
            'Sync Pending',
            'Pehle kal ka data sync upload karein, phir hi aaj ka data download hoga!',
            [{ text: 'OK' }]
          );
          setStep('need_download');
          return;
        }
        setStep('need_download');
        return;
      }

      // Step 4: Check if route is started — read from AsyncStorage directly
      const sessionId = await StorageService.getRouteSessionId();
      const routeActive = !!(sessionId) || isTracking;

      if (!routeActive) {
        setStep('need_route_start');
        return;
      }

      // All checks passed — ready to show shops
      setStep('ready');
    } finally {
      isEvaluating.current = false;
    }
  }, [isLoading, user, isUrlSet, isTracking]);

  // Re-evaluate step whenever this screen comes into focus
  // This is critical: when other screens (setup-url, download, route-start)
  // call router.replace('/'), this screen regains focus and re-evaluates
  useFocusEffect(
    useCallback(() => {
      determineStep();
    }, [determineStep])
  );

  // Also evaluate on mount and when deps change
  useEffect(() => {
    determineStep();
  }, [determineStep]);

  if (step === 'loading') {
    return (
      <AuroraBackground style={styles.center}>
        <ActivityIndicator size="large" color={AuroraColors.indigo600} />
      </AuroraBackground>
    );
  }

  if (step === 'need_url') {
    return <Redirect href="/setup-url" />;
  }

  if (step === 'need_login') {
    return <Redirect href="/login" />;
  }

  if (step === 'need_download') {
    return <Redirect href="/download" />;
  }

  if (step === 'need_route_start') {
    return <Redirect href="/route-start" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
