// =================================================================
// AURORA GLASS — NEON BUTTON (primary CTA, theme-aware)
// LIGHT: brand gradient (indigo → violet → indigo), white text, indigo glow
// DARK : brand gradient (gold-500 → gold-400 → gold-300), dark text, gold glow
// Variants:
//   • primary  — brand gradient (indigo light / gold dark), glow shadow
//   • danger   — rose gradient, white text, danger glow
//   • ghost    — transparent bg, brand-colored text, no shadow
//   • glass    — glassmorphic bg, primary text, sm shadow
// =================================================================
import React, { useCallback } from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  StyleProp,
  TextStyle,
  ViewStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  AuroraFont,
  AuroraShadowType,
  GlowTone,
} from '@/constants/auroraTheme';
import { useTheme } from '@/contexts/ThemeContext';

type ButtonVariant = 'primary' | 'danger' | 'ghost' | 'glass';

interface NeonButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  /** Stretch to fill container width */
  fullWidth?: boolean;
}

export default function NeonButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  labelStyle,
  fullWidth = true,
}: NeonButtonProps) {
  const { colors, gradients, shadows, isDark } = useTheme();

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [disabled, loading, onPress]);

  // Resolve gradient colors per variant + theme
  const VARIANT_GRADIENT: Record<
    ButtonVariant,
    readonly [string, string, string] | null
  > = {
    primary: gradients.brand,
    danger: gradients.danger,
    ghost: null,
    glass: null,
  };

  const VARIANT_SHADOW: Record<ButtonVariant, AuroraShadowType | null> = {
    primary: shadows.btnPrimary,
    danger: {
      ...shadows.btnPrimary,
      shadowColor: colors.rose500,
      shadowOpacity: 0.32,
    },
    ghost: null,
    glass: shadows.sm,
  };

  const gradient = VARIANT_GRADIENT[variant];
  const shadow = VARIANT_SHADOW[variant];

  const containerStyle: StyleProp<ViewStyle> = [
    styles.base,
    fullWidth && styles.fullWidth,
    shadow,
    variant === 'glass' && {
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.borderDefault,
    },
    disabled && styles.disabled,
    style,
  ];

  // Label color logic:
  //  - ghost: brand accent (indigo in light, gold in dark)
  //  - glass: textPrimary
  //  - primary: white text on indigo (light), dark navy text on gold (dark)
  //  - danger: white text always
  const labelColor =
    variant === 'ghost'
      ? isDark
        ? colors.gold400
        : colors.indigo600
      : variant === 'glass'
        ? colors.textPrimary
        : variant === 'primary' && isDark
          ? colors.textInverse // dark navy on gold gradient
          : colors.textInverse; // white on indigo / rose

  const content = (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={labelColor as string} />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <Text
            style={[styles.label, { color: labelColor }, labelStyle]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </>
  );

  if (gradient) {
    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled || loading}
        style={({ pressed }) => [containerStyle, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
      >
        <LinearGradient
          colors={gradient as [string, string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.content}>{content}</View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [containerStyle, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <View style={styles.content}>{content}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12, // AuroraRadius.rMd
    minHeight: 48,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  label: {
    fontFamily: AuroraFont.sans,
    fontSize: AuroraFont.fsBase, // 15px
    fontWeight: AuroraFont.bold,
    letterSpacing: 0.2,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.5,
  },
});

// Re-export GlowTone for callers that need it
export type { GlowTone };
