// =================================================================
// AURORA GLASS — BISMILLAH SPLASH
// Brand gradient (indigo→violet→indigo) background with floating
// glassmorphic orb behind Bismillah text. Auto-dismisses after 3s.
// =================================================================
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AuroraColors,
  AuroraGradients,
  AuroraFont,
  AuroraShadow,
} from '@/constants/auroraTheme';

interface BismillahSplashProps {
  onFinish: () => void;
}

export function BismillahSplash({ onFinish }: BismillahSplashProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const orbPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in + scale spring
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        tension: 60,
        friction: 8,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();

    // Subtle orb breathing pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbPulse, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(orbPulse, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Auto-dismiss after 3 seconds
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const orbScale = orbPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[
          AuroraGradients.brandStart, // #4F46E5
          AuroraGradients.brandMid, // #7C3AED
          AuroraGradients.brandEnd, // #6366F1
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
        {/* Floating glassmorphic orb behind text */}
        <Animated.View
          style={[styles.glowOrb, { transform: [{ scale: orbScale }] }]}
          pointerEvents="none"
        />

        {/* Bismillah Arabic Text */}
        <Text style={styles.bismillahText}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</Text>

        {/* Decorative line */}
        <View style={styles.decorativeLine}>
          <View style={styles.lineSegment} />
          <View style={styles.diamond} />
          <View style={styles.lineSegment} />
        </View>

        {/* App name */}
        <Text style={styles.appName}>Finexa Recovery App</Text>
      </Animated.View>
    </View>
  );
}

const ORB_SIZE = 320;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    overflow: 'hidden',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  // Floating glow orb — semi-transparent white circle behind the text
  glowOrb: {
    position: 'absolute',
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    top: -40,
    ...AuroraShadow.xl,
  },
  bismillahText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: AuroraColors.textInverse,
    textAlign: 'center',
    lineHeight: 52,
    fontFamily: 'System',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  decorativeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 20,
  },
  lineSegment: {
    width: 40,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  diamond: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.75)',
    transform: [{ rotate: '45deg' }],
  },
  appName: {
    fontSize: 16,
    fontWeight: AuroraFont.semibold as any,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.2,
    fontFamily: AuroraFont.sans,
  },
});
