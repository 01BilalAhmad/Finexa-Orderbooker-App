// ═══════════════════════════════════════════════════════════════════════════
//  NeonButton — Premium CTA with neon indigo gradient + glow shadow + haptics
//  Supports variants: primary (indigo), success, danger, ghost (glass outline)
//  Auto-handles press scale with Reanimated 4 worklets
// ═══════════════════════════════════════════════════════════════════════════
import React, { useEffect } from 'react';
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AuroraColors, AuroraGradients, AuroraFont, AuroraRadius, AuroraShadow } from '@/constants/auroraTheme';

type ButtonVariant = 'primary' | 'success' | 'danger' | 'ghost' | 'subtle';
type ButtonSize = 'sm' | 'md' | 'lg';

interface NeonButtonProps {
  label: string;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  haptic?: boolean;
}

const VARIANT_GRADIENT: Record<ButtonVariant, string[] | null> = {
  primary: [...AuroraGradients.primary] as string[],
  success: [...AuroraGradients.success] as string[],
  danger: [...AuroraGradients.danger] as string[],
  ghost: null,  // no gradient — pure glass
  subtle: null,  // minimal style
};

const VARIANT_GLOW: Record<ButtonVariant, { shadowColor: string; opacity: number }> = {
  primary: { shadowColor: AuroraColors.neonIndigo, opacity: 0.55 },
  success: { shadowColor: AuroraColors.success, opacity: 0.45 },
  danger:  { shadowColor: AuroraColors.danger, opacity: 0.45 },
  ghost:   { shadowColor: AuroraColors.neonViolet, opacity: 0.25 },
  subtle:  { shadowColor: '#000', opacity: 0.20 },
};

const SIZE_PRESET: Record<ButtonSize, { height: number; radius: keyof typeof AuroraRadius; fontSize: number; paddingH: number }> = {
  sm: { height: 40, radius: 'sm', fontSize: AuroraFont.size.sm, paddingH: 14 },
  md: { height: 52, radius: 'md', fontSize: AuroraFont.size.base, paddingH: 20 },
  lg: { height: 60, radius: 'lg', fontSize: AuroraFont.size.lg, paddingH: 28 },
};

export function NeonButton({
  label,
  onPress,
  onLongPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  fullWidth = false,
  style,
  textStyle,
  haptic = true,
}: NeonButtonProps) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(disabled ? 0 : VARIANT_GLOW[variant].opacity);

  const sizePreset = SIZE_PRESET[size];
  const radiusValue = AuroraRadius[sizePreset.radius];
  const gradient = VARIANT_GRADIENT[variant];

  useEffect(() => {
    glow.value = withTiming(disabled ? 0 : VARIANT_GLOW[variant].opacity, {
      duration: 200,
      easing: Easing.out(Easing.ease),
    });
  }, [disabled, glow, variant]);

  const triggerHaptic = () => {
    if (haptic && !disabled && !loading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handlePressIn = () => {
    if (disabled) return;
    scale.value = withSpring(0.96, {
      damping: 15,
      stiffness: 350,
    });
    runOnJS(triggerHaptic)();
  };

  const handlePressOut = () => {
    if (disabled) return;
    scale.value = withSpring(1, {
      damping: 12,
      stiffness: 280,
    });
    // Subtle glow pulse on release
    glow.value = withTiming(VARIANT_GLOW[variant].opacity * 1.4, {
      duration: 150,
    }, () => {
      glow.value = withTiming(VARIANT_GLOW[variant].opacity, { duration: 250 });
    });
  };

  const animatedScale = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedGlow = useAnimatedStyle(() => ({
    shadowOpacity: glow.value,
  }));

  // Ghost & subtle variants — glass outline, no gradient fill
  if (variant === 'ghost' || variant === 'subtle') {
    const isGhost = variant === 'ghost';
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || loading }}
      >
        <Animated.View
          style={[
            styles.base,
            {
              height: sizePreset.height,
              borderRadius: radiusValue,
              paddingHorizontal: sizePreset.paddingH,
              backgroundColor: isGhost
                ? AuroraColors.glassBase
                : 'transparent',
              borderWidth: isGhost ? 1 : 0,
              borderColor: isGhost ? AuroraColors.glassBorder : 'transparent',
            },
            AuroraShadow.float,
            fullWidth && { width: '100%' as any },
            style as any,
            animatedScale,
            animatedGlow,
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={AuroraColors.text} />
          ) : (
            <>
              {icon ? <View style={styles.iconLeft}>{icon}</View> : null}
              <Text
                style={[
                  styles.label,
                  {
                    fontSize: sizePreset.fontSize,
                    color: disabled ? AuroraColors.textMuted : AuroraColors.text,
                  },
                  textStyle,
                ]}
              >
                {label}
              </Text>
              {iconRight ? <View style={styles.iconRight}>{iconRight}</View> : null}
            </>
          )}
        </Animated.View>
      </Pressable>
    );
  }

  // Gradient-filled variants (primary, success, danger)
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
    >
      <Animated.View
        style={[
          styles.base,
          {
            height: sizePreset.height,
            borderRadius: radiusValue,
            shadowColor: VARIANT_GLOW[variant].shadowColor,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 16,
            elevation: 6,
          },
          fullWidth && { width: '100%' as any },
          style as any,
          animatedScale,
          animatedGlow,
        ]}
      >
        <LinearGradient
          colors={gradient as unknown as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: radiusValue, opacity: disabled ? 0.4 : 1 },
          ]}
        />
        {/* Inner top highlight — fake glass reflection */}
        <View style={styles.innerHighlight} pointerEvents="none" />
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              {icon ? <View style={styles.iconLeft}>{icon}</View> : null}
              <Text
                style={[
                  styles.label,
                  {
                    fontSize: sizePreset.fontSize,
                    color: '#FFFFFF',
                  },
                  textStyle,
                ]}
              >
                {label}
              </Text>
              {iconRight ? <View style={styles.iconRight}>{iconRight}</View> : null}
            </>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

// Need View import for icon wrappers

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconLeft: {
    marginRight: 4,
  },
  iconRight: {
    marginLeft: 4,
  },
  label: {
    fontWeight: AuroraFont.weight.bold,
    letterSpacing: AuroraFont.tracking.wide,
    textAlign: 'center',
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

export default NeonButton;
