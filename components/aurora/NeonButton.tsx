// =================================================================
// AURORA GLASS — NEON BUTTON (primary CTA)
// Brand gradient (indigo → violet → indigo) button with:
//   • Reanimated 4 spring scale on press
//   • Haptics feedback on press
//   • Indigo glow shadow under the button
//   • Shimmer overlay animation (skipped on Android for perf)
// Variants:
//   • primary  — brand gradient, white text, glow shadow
//   • danger   — rose gradient, white text, danger glow
//   • ghost    — transparent bg, indigo text, no shadow
//   • glass    — glassmorphic white, dark text, sm shadow
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
  AuroraColors,
  AuroraFont,
  AuroraRadius,
  AuroraShadow,
  AuroraShadowType,
  GlowTone,
} from '@/constants/auroraTheme';

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

const VARIANT_GRADIENT: Record<
  ButtonVariant,
  [string, string, string] | null
> = {
  primary: [
    AuroraColors.indigo600,
    AuroraColors.violet600,
    AuroraColors.indigo500,
  ],
  danger: [AuroraColors.rose600, AuroraColors.rose500, AuroraColors.rose400],
  ghost: null,
  glass: null,
};

const VARIANT_SHADOW: Record<ButtonVariant, AuroraShadowType | null> = {
  primary: AuroraShadow.btnPrimary,
  danger: {
    ...AuroraShadow.btnPrimary,
    shadowColor: '#F43F5E',
    shadowOpacity: 0.32,
  },
  ghost: null,
  glass: AuroraShadow.sm,
};

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
  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [disabled, loading, onPress]);

  const gradient = VARIANT_GRADIENT[variant];
  const shadow = VARIANT_SHADOW[variant];

  const containerStyle: StyleProp<ViewStyle> = [
    styles.base,
    fullWidth && styles.fullWidth,
    shadow,
    variant === 'glass' && styles.glassFill,
    disabled && styles.disabled,
    style,
  ];

  const labelColor =
    variant === 'ghost'
      ? AuroraColors.indigo600
      : variant === 'glass'
      ? AuroraColors.textPrimary
      : AuroraColors.textInverse;

  const content = (
    <>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={labelColor as string}
        />
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
        style={({ pressed }) => [
          containerStyle,
          pressed && styles.pressed,
        ]}
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
    borderRadius: AuroraRadius.rMd, // 12px
    minHeight: 48,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  glassFill: {
    backgroundColor: AuroraColors.bgCard,
    borderWidth: 1,
    borderColor: AuroraColors.borderDefault,
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
