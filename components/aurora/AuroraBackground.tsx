// =================================================================
// AURORA GLASS — APP BACKGROUND
// Slate-50 base (#F8FAFC) with two soft radial gradient orbs:
//   • top-left (violet #7C3AED @ 16% opacity)
//   • bottom-right (indigo #4F46E5 @ 14% opacity)
// On iOS the orbs use BlurView for true glassmorphism; on Android
// they fall back to plain translucent circles (still readable on
// the light base).
// =================================================================
import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuroraColors, AuroraGradients } from '@/constants/auroraTheme';

interface AuroraBackgroundProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Whether to render the floating orbs. Default: true */
  withOrbs?: boolean;
}

export default function AuroraBackground({
  children,
  style,
  withOrbs = true,
}: AuroraBackgroundProps) {
  return (
    <View style={[styles.root, style]}>
      {withOrbs && (
        <>
          {/* Top-left violet orb */}
          <View
            style={[styles.orbBase, styles.orbTopLeft]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={[AuroraGradients.orbTopLeft, 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </View>

          {/* Bottom-right indigo orb */}
          <View
            style={[styles.orbBase, styles.orbBottomRight]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={[AuroraGradients.orbBottomRight, 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 1, y: 1 }}
              end={{ x: 0, y: 0 }}
            />
          </View>
        </>
      )}

      {/* Content (z-10 above orbs) */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AuroraColors.bgPage,
    position: 'relative',
    overflow: 'hidden',
  },
  // Orbs are big translucent circles positioned at the corners.
  // Using borderRadius:9999 makes them perfect circles.
  orbBase: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  orbTopLeft: {
    top: -120,
    left: -100,
  },
  orbBottomRight: {
    bottom: -120,
    right: -100,
  },
  content: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
});
