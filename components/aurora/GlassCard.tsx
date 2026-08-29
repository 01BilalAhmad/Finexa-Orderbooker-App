// =================================================================
// AURORA GLASS — GLASS CARD (theme-aware)
// LIGHT: white glassmorphic card (rgba(255,255,255,0.78)) with slate
//   border, soft indigo-tinted shadow.
// DARK : dark navy glass card (rgba(20,28,52,0.78)) with gold-tinted
//   border, soft black shadow with gold glow option.
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
  AuroraShadowType,
  GlowTone,
} from '@/constants/auroraTheme';
import { useTheme } from '@/contexts/ThemeContext';

interface GlassCardProps extends ViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Glow tone — adds a colored glow shadow underneath the card */
  glow?: GlowTone;
  /** Skip the fill — for transparent overlay cards (rare) */
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

export default function GlassCard({
  children,
  style,
  glow = 'default',
  transparent = false,
  padding = 'md',
  ...rest
}: GlassCardProps) {
  const { colors, shadows, isDark } = useTheme();

  // Resolve glow shadow per theme + glow tone
  const GLOW_SHADOW_MAP: Record<GlowTone, AuroraShadowType> = {
    default: shadows.sm,
    brand: {
      ...shadows.md,
      shadowColor: isDark ? colors.gold400 : colors.indigo600,
      shadowOpacity: isDark ? 0.32 : 0.12,
    },
    danger: {
      ...shadows.md,
      shadowColor: colors.rose500,
      shadowOpacity: 0.20,
    },
    success: {
      ...shadows.md,
      shadowColor: colors.emerald500,
      shadowOpacity: 0.20,
    },
  };

  const cardFillStyle = !transparent
    ? Platform.OS === 'ios'
      ? { backgroundColor: colors.bgCard }
      : isDark
        ? { backgroundColor: colors.bgCard } // dark: keep translucent navy
        : { backgroundColor: '#FFFFFF' }     // light Android fallback
    : null;

  // On iOS we can use BlurView for real backdrop blur. On Android it's
  // a costly no-op (blur is not supported), so we fall back to a semi-
  // translucent background that visually still reads as glass.
  if (Platform.OS === 'ios' && !transparent) {
    return (
      <View style={[styles.outerGlow, GLOW_SHADOW_MAP[glow], style]}>
        <BlurView
          intensity={isDark ? 40 : 60}
          tint={isDark ? 'dark' : 'light'}
          style={[
            styles.card,
            { padding: PADDING_MAP[padding] },
            { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle },
          ]}
          {...(rest as any)}
        >
          {children}
        </BlurView>
      </View>
    );
  }

  // Android / fallback — semi-translucent card with elevation
  return (
    <View
      style={[
        styles.outerGlow,
        GLOW_SHADOW_MAP[glow],
        styles.card,
        { padding: PADDING_MAP[padding] },
        cardFillStyle,
        { borderColor: colors.borderSubtle },
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
    borderRadius: 20, // AuroraRadius.rXl
    overflow: 'hidden',
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
  },
});
