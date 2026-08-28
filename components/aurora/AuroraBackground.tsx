// ═══════════════════════════════════════════════════════════════════════════
//  AuroraBackground — Full-screen animated aurora gradient backdrop
//  Deep midnight base + floating indigo/violet/pink orbs with subtle motion
// ═══════════════════════════════════════════════════════════════════════════
import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { AuroraColors, AuroraGradients, AuroraOrbs } from '@/constants/auroraTheme';

type OrbConfig = (typeof AuroraOrbs)[number];

/**
 * AuroraOrb — single floating blurred orb that drifts slowly.
 * Use Reanimated 4 worklets so animation stays on UI thread.
 */
function AuroraOrb({ orb, index }: { orb: OrbConfig; index: number }) {
  // Stagger each orb's drift by index so they don't all move in sync
  const driftX = useSharedValue(0);
  const driftY = useSharedValue(0);

  useEffect(() => {
    const offsetX = (index % 2 === 0 ? 1 : -1) * 30;
    const offsetY = (index % 3 === 0 ? 1 : -1) * 24;

    driftX.value = withRepeat(
      withTiming(offsetX, {
        duration: 8000 + index * 1500,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
    driftY.value = withRepeat(
      withTiming(offsetY, {
        duration: 9000 + index * 1200,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [driftX, driftY, index]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: driftX.value },
        { translateY: driftY.value },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        {
          width: orb.size,
          height: orb.size,
          left: orb.x,
          top: orb.y,
          backgroundColor: orb.color,
          // Android fallback — blur not supported natively, but the
          // translucent color + elevation gives a similar glow feel
          borderRadius: orb.size / 2,
          ...Platform.select({
            ios: {
              shadowColor: orb.color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: orb.blur,
            },
            android: {
              elevation: 0, // keep flat — color already provides the glow
            },
          }),
        },
        animatedStyle,
      ]}
    />
  );
}

interface AuroraBackgroundProps {
  /**
   * Optional style override for the root container
   */
  style?: ViewStyle;
  /**
   * Whether to render orbs (default true)
   */
  showOrbs?: boolean;
  /**
   * Children to render on top of the aurora background
   */
  children?: React.ReactNode;
  /**
   * Optional top safe area color tint
   */
  topTint?: string;
}

/**
 * AuroraBackground — wraps the entire screen in a deep midnight gradient
 * with floating colored orbs that simulate the northern lights effect.
 *
 * Usage:
 *   <AuroraBackground>
 *     <GlassCard>...</GlassCard>
 *   </AuroraBackground>
 */
export function AuroraBackground({
  style,
  showOrbs = true,
  children,
  topTint,
}: AuroraBackgroundProps) {
  return (
    <View style={[styles.root, style]}>
      {/* Base gradient — deep midnight */}
      <LinearGradient
        colors={AuroraGradients.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Optional top tint for status bar area */}
      {topTint ? (
        <View style={[styles.topTint, { backgroundColor: topTint }]} />
      ) : null}

      {/* Floating aurora orbs */}
      {showOrbs ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {AuroraOrbs.map((orb, i) => (
            <AuroraOrb key={i} orb={orb} index={i} />
          ))}
        </View>
      ) : null}

      {/* Content on top */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: AuroraColors.bgDeep,
  },
  topTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    opacity: 0.3,
  },
  orb: {
    position: 'absolute',
  },
});
