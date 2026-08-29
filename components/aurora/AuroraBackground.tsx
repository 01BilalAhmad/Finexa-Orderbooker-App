// =================================================================
// AURORA GLASS — APP BACKGROUND (theme-aware)
// LIGHT: slate-50 base (#F8FAFC) with violet + indigo radial orbs
// DARK : midnight navy (#050817) with gold + violet radial orbs
// On iOS the orbs use BlurView for true glassmorphism; on Android
// they fall back to plain translucent circles (still readable on the
// underlying base color).
// =================================================================
import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';

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
  const { colors, gradients, isDark } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.bgPage }, style]}>
      {withOrbs && (
        <>
          {/* Top-left orb (violet in light, gold in dark) */}
          <View
            style={[styles.orbBase, styles.orbTopLeft]}
            pointerEvents="none"
          >
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={isDark ? 40 : 60}
                tint={isDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              >
                <LinearGradient
                  colors={[gradients.orbTopLeft, 'transparent']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              </BlurView>
            ) : (
              <LinearGradient
                colors={[gradients.orbTopLeft, 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            )}
          </View>

          {/* Bottom-right orb (indigo in light, violet in dark) */}
          <View
            style={[styles.orbBase, styles.orbBottomRight]}
            pointerEvents="none"
          >
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={isDark ? 40 : 60}
                tint={isDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              >
                <LinearGradient
                  colors={[gradients.orbBottomRight, 'transparent']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 1, y: 1 }}
                  end={{ x: 0, y: 0 }}
                />
              </BlurView>
            ) : (
              <LinearGradient
                colors={[gradients.orbBottomRight, 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 1, y: 1 }}
                end={{ x: 0, y: 0 }}
              />
            )}
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
    position: 'relative',
    overflow: 'hidden',
  },
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
