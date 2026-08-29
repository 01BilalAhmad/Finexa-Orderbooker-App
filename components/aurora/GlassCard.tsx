// =================================================================
// AURORA GLASS — GLASS CARD
// White glassmorphic card with:
//   • background rgba(255,255,255,0.78)
//   • backdrop blur (iOS BlurView, Android fallback to elevated white)
//   • subtle slate border
//   • soft indigo-tinted shadow
// Optional glow tone variants: 'default' | 'brand' | 'danger' | 'success'
// =================================================================
import React from 'react';
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Platform,
  ViewProps,
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
  AuroraColors,
  AuroraRadius,
  AuroraShadow,
  AuroraShadowType,
  GlowTone,
} from '@/constants/auroraTheme';

interface GlassCardProps extends ViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Glow tone — adds a colored glow shadow underneath the card */
  glow?: GlowTone;
  /** Skip the white fill — for transparent overlay cards (rare) */
  transparent?: boolean;
  /** Card padding preset: 'none' | 'sm' | 'md' | 'lg' */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING_MAP: Record<NonNullable<GlassCardProps['padding']>, number> = {
  none: 0,
  sm: 12,
  md: 16,
  lg: 20,
};

const GLOW_SHADOW_MAP: Record<GlowTone, AuroraShadowType> = {
  default: AuroraShadow.sm,
  brand: AuroraShadow.md,
  danger: {
    ...AuroraShadow.md,
    shadowColor: '#F43F5E', // rose-500
    shadowOpacity: 0.20,
  },
  success: {
    ...AuroraShadow.md,
    shadowColor: '#10B981', // emerald-500
    shadowOpacity: 0.20,
  },
};

export default function GlassCard({
  children,
  style,
  glow = 'default',
  transparent = false,
  padding = 'md',
  ...rest
}: GlassCardProps) {
  // On iOS we can use BlurView for real backdrop blur. On Android it's
  // a costly no-op (blur is not supported), so we fall back to a semi-
  // translucent white background that visually still reads as glass.
  if (Platform.OS === 'ios' && !transparent) {
    return (
      <View style={[styles.outerGlow, GLOW_SHADOW_MAP[glow], style]}>
        <BlurView
          intensity={60}
          tint="light"
          style={[
            styles.card,
            { padding: PADDING_MAP[padding] },
            !transparent && styles.cardFill,
          ]}
          {...(rest as any)}
        >
          {children}
        </BlurView>
      </View>
    );
  }

  // Android / fallback — semi-translucent white card with elevation
  return (
    <View
      style={[
        styles.outerGlow,
        GLOW_SHADOW_MAP[glow],
        styles.card,
        { padding: PADDING_MAP[padding] },
        !transparent && styles.cardFillFallback,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  outerGlow: {
    borderRadius: AuroraRadius.rXl, // 20px
    overflow: 'hidden',
  },
  card: {
    borderWidth: 1,
    borderColor: AuroraColors.borderSubtle,
    borderRadius: AuroraRadius.rXl,
  },
  cardFill: {
    backgroundColor: AuroraColors.bgCard, // rgba(255,255,255,0.78)
  },
  cardFillFallback: {
    // Android: pure white is more legible than translucent.
    // Slate-50 backdrop is light enough that solid white reads as glass.
    backgroundColor: '#FFFFFF',
  },
});
