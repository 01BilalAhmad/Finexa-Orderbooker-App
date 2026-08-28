// ═══════════════════════════════════════════════════════════════════════════
//  GlassCard — Glassmorphic card with backdrop blur (iOS) + simulated glass (Android)
//  Semi-transparent surface with hairline border + soft neon glow shadow
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { View, StyleSheet, Platform, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { AuroraColors, AuroraRadius, AuroraShadow, AuroraSpacing } from '@/constants/auroraTheme';

type GlassVariant = 'base' | 'strong' | 'subtle';
type GlowTone = 'none' | 'indigo' | 'success' | 'danger' | 'warning' | 'info';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Glass opacity variant:
   *  - subtle: very faint (for nested elements)
   *  - base:   standard glass card
   *  - strong: modal/dialog glass
   */
  variant?: GlassVariant;
  /**
   * Optional neon glow tone around the card
   */
  glow?: GlowTone;
  /**
   * Padding preset (uses AuroraSpacing scale)
   */
  padding?: keyof typeof AuroraSpacing | number;
  /**
   * Radius preset (uses AuroraRadius scale)
   */
  radius?: keyof typeof AuroraRadius | number;
  /**
   * Disable blur (use plain translucent overlay)
   */
  noBlur?: boolean;
  /**
   * Override border color
   */
  borderColor?: string;
  /**
   * Override background color
   */
  backgroundColor?: string;
}

const GLASS_OPACITY: Record<GlassVariant, number> = {
  subtle: 0.04,
  base: 0.06,
  strong: 0.14,
};

const GLOW_TONES: Record<GlowTone, { color: string; opacity: number; radius: number } | null> = {
  none: null,
  indigo: { color: AuroraColors.neonIndigo, opacity: 0.30, radius: 16 },
  success: { color: AuroraColors.success, opacity: 0.30, radius: 14 },
  danger: { color: AuroraColors.danger, opacity: 0.30, radius: 14 },
  warning: { color: AuroraColors.warning, opacity: 0.30, radius: 14 },
  info: { color: AuroraColors.info, opacity: 0.30, radius: 14 },
};

export function GlassCard({
  children,
  style,
  variant = 'base',
  glow = 'none',
  padding = 'lg',
  radius = 'lg',
  noBlur = false,
  borderColor,
  backgroundColor,
}: GlassCardProps) {
  const padValue = typeof padding === 'number' ? padding : AuroraSpacing[padding];
  const radiusValue = typeof radius === 'number' ? radius : AuroraRadius[radius];
  const opacity = GLASS_OPACITY[variant];
  const glowConfig = GLOW_TONES[glow];

  const baseStyle: ViewStyle = {
    borderRadius: radiusValue,
    padding: padValue,
    borderWidth: 1,
    borderColor: borderColor ?? AuroraColors.glassBorder,
    backgroundColor: backgroundColor ?? `rgba(255, 255, 255, ${opacity})`,
    overflow: 'hidden',
  };

  const glowStyle: ViewStyle = glowConfig
    ? {
        shadowColor: glowConfig.color,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: glowConfig.opacity,
        shadowRadius: glowConfig.radius,
        elevation: 4,
      }
    : AuroraShadow.glass;

  // iOS: use BlurView for true backdrop blur
  if (Platform.OS === 'ios' && !noBlur) {
    return (
      <View style={[baseStyle, glowStyle, style]}>
        <BlurView
          intensity={variant === 'strong' ? 80 : 60}
          tint="dark"
          style={[StyleSheet.absoluteFill, { borderRadius: radiusValue }]}
        />
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  // Android: simulated glass (semi-transparent + inner highlight border)
  return (
    <View style={[baseStyle, glowStyle, style]}>
      {/* Inner top highlight — fake glass reflection */}
      <View style={styles.innerHighlight} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 0,
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.30)',
  },
});

export default GlassCard;
