// ═══════════════════════════════════════════════════════════════════════════
//  GlassInput — Glassmorphic text input with leading icon + focus glow
//  Auto-handles focus state with Reanimated 4 worklets
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  Pressable,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { AuroraColors, AuroraRadius, AuroraFont, AuroraSpacing } from '@/constants/auroraTheme';

interface GlassInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  error?: string;
  hint?: string;
}

export function GlassInput({
  label,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  inputStyle,
  labelStyle,
  error,
  hint,
  ...textInputProps
}: GlassInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const glowOpacity = useSharedValue(0);
  // Use a flexible string type so we can switch between glass border and semantic colors
  const borderColor = useSharedValue<string>(AuroraColors.glassBorder);

  useEffect(() => {
    if (error) {
      glowOpacity.value = withTiming(0.45, { duration: 250 });
      borderColor.value = withTiming(AuroraColors.danger, { duration: 250 });
    } else if (isFocused) {
      glowOpacity.value = withTiming(0.55, { duration: 250 });
      borderColor.value = withTiming(AuroraColors.neonIndigo, { duration: 250 });
    } else {
      glowOpacity.value = withTiming(0, { duration: 250 });
      borderColor.value = withTiming(AuroraColors.glassBorder, { duration: 250 });
    }
  }, [isFocused, error, glowOpacity, borderColor]);

  const borderAnim = useAnimatedStyle(() => ({
    borderColor: borderColor.value,
    shadowOpacity: glowOpacity.value,
  }));

  return (
    <View style={containerStyle}>
      {label ? (
        <Text style={[styles.label, labelStyle]}>{label}</Text>
      ) : null}

      <Animated.View
        style={[
          styles.inputWrapper,
          borderAnim,
          error && { borderColor: AuroraColors.danger },
        ]}
      >
        {leftIcon ? <View style={styles.leftIconBox}>{leftIcon}</View> : null}

        <TextInput
          {...textInputProps}
          style={[styles.input, inputStyle]}
          placeholderTextColor={textInputProps.placeholderTextColor ?? AuroraColors.textMuted}
          onFocus={(e) => {
            setIsFocused(true);
            textInputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            textInputProps.onBlur?.(e);
          }}
        />

        {rightIcon ? (
          <Pressable
            onPress={onRightIconPress}
            hitSlop={8}
            style={styles.rightIconBox}
            disabled={!onRightIconPress}
          >
            {rightIcon}
          </Pressable>
        ) : null}
      </Animated.View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: AuroraFont.size.xs,
    fontWeight: AuroraFont.weight.bold,
    color: AuroraColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: AuroraFont.tracking.wider,
    marginBottom: 6,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    backgroundColor: AuroraColors.glassBase,
    borderWidth: 1.5,
    borderRadius: AuroraRadius.md,
    paddingHorizontal: AuroraSpacing.sm,
    shadowColor: AuroraColors.neonIndigo,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 2,
  },
  leftIconBox: {
    width: 42,
    height: 42,
    borderRadius: AuroraRadius.sm,
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: AuroraSpacing.xs,
  },
  input: {
    flex: 1,
    fontSize: AuroraFont.size.base,
    color: AuroraColors.text,
    paddingVertical: 0,
    height: '100%',
  },
  rightIconBox: {
    width: 40,
    height: 40,
    borderRadius: AuroraRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: AuroraFont.size.xs,
    color: AuroraColors.danger,
    fontWeight: AuroraFont.weight.semibold,
    marginTop: 6,
    marginLeft: 4,
  },
  hintText: {
    fontSize: AuroraFont.size.xs,
    color: AuroraColors.textMuted,
    marginTop: 6,
    marginLeft: 4,
  },
});

export default GlassInput;
