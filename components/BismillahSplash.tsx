// Bismillah Splash Screen — Aurora Glass premium splash on midnight backdrop
// Shows "بسم الله الرحمن الرحیم" for 3 seconds with neon glow
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuroraColors } from '@/constants/auroraTheme';

interface BismillahSplashProps {
  onFinish: () => void;
}

export function BismillahSplash({ onFinish }: BismillahSplashProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in animation
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss after 3 seconds
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onFinish();
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      {/* Aurora gradient backdrop */}
      <LinearGradient
        colors={[AuroraColors.bgVoid, AuroraColors.bgDeep, AuroraColors.bgSoft]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Floating aurora orbs (static — no animation for performance) */}
      <View style={[styles.orb, styles.orbIndigo]} pointerEvents="none" />
      <View style={[styles.orb, styles.orbViolet]} pointerEvents="none" />
      <View style={[styles.orb, styles.orbPink]} pointerEvents="none" />

      <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
        {/* Neon glow halo around text */}
        <Animated.View
          style={[styles.textGlow, { opacity: glowOpacity }]}
          pointerEvents="none"
        />

        {/* Bismillah Arabic Text */}
        <Text style={styles.bismillahText}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</Text>

        {/* Decorative line with neon accent */}
        <View style={styles.decorativeLine}>
          <View style={styles.lineSegment} />
          <View style={styles.diamond} />
          <View style={styles.lineSegment} />
        </View>

        {/* App name with subtle indigo glow */}
        <Text style={styles.appName}>Finexa Recovery</Text>
        <Text style={styles.appTagline}>Powered by Finexa</Text>
      </Animated.View>
    </View>
  );
}

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
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  orbIndigo: {
    width: 320,
    height: 320,
    top: -80,
    left: -80,
    backgroundColor: 'rgba(99, 102, 241, 0.30)',
  },
  orbViolet: {
    width: 260,
    height: 260,
    bottom: -60,
    right: -60,
    backgroundColor: 'rgba(167, 139, 250, 0.25)',
  },
  orbPink: {
    width: 200,
    height: 200,
    top: '50%',
    right: -60,
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
  },
  textGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(99, 102, 241, 0.20)',
    shadowColor: AuroraColors.neonIndigo,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 0,
  },
  bismillahText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 52,
    textShadowColor: AuroraColors.neonGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    zIndex: 2,
  },
  decorativeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 20,
    zIndex: 2,
  },
  lineSegment: {
    width: 50,
    height: 1.5,
    backgroundColor: AuroraColors.neonViolet,
    shadowColor: AuroraColors.neonIndigo,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 2,
  },
  diamond: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: AuroraColors.neonPurple,
    transform: [{ rotate: '45deg' }],
    shadowColor: AuroraColors.neonViolet,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.4,
    zIndex: 2,
  },
  appTagline: {
    fontSize: 13,
    color: AuroraColors.textMuted,
    marginTop: 4,
    letterSpacing: 1.2,
    fontWeight: '600',
    zIndex: 2,
  },
});
