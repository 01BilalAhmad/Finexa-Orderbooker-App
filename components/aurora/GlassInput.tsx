// =================================================================
// AURORA GLASS — GLASS INPUT
// White elevated input (rgba(255,255,255,0.92)) with:
//   • slate border (subtle → brand on focus)
//   • leading/trailing icon support
//   • focus glow shadow (indigo-tinted)
//   • spring border-color transition via Reanimated 4 shared value
// =================================================================
import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  StyleProp,
  ViewStyle,
  TextInputProps,
  Animated,
} from 'react-native';
import {
  AuroraColors,
  AuroraFont,
  AuroraRadius,
  AuroraShadow,
} from '@/constants/auroraTheme';

interface GlassInputProps extends Omit<TextInputProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<ViewStyle>;
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export default function GlassInput({
  style,
  inputStyle,
  label,
  hint,
  error,
  leadingIcon,
  trailingIcon,
  placeholderTextColor,
  ...rest
}: GlassInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  // Animated border color (spring into indigo on focus)
  const borderColor = useRef(
    new Animated.Value(0) // 0 = default, 1 = focused
  ).current;

  const onFocus = useCallback(
    (e: any) => {
      setIsFocused(true);
      Animated.spring(borderColor, {
        toValue: 1,
        useNativeDriver: false,
        tension: 200,
        friction: 12,
      }).start();
      rest.onFocus?.(e);
    },
    [borderColor, rest]
  );

  const onBlur = useCallback(
    (e: any) => {
      setIsFocused(false);
      Animated.spring(borderColor, {
        toValue: 0,
        useNativeDriver: false,
        tension: 200,
        friction: 12,
      }).start();
      rest.onBlur?.(e);
    },
    [borderColor, rest]
  );

  const interpolatedBorderColor = borderColor.interpolate({
    inputRange: [0, 1],
    outputRange: [
      AuroraColors.borderDefault as string,
      AuroraColors.indigo400 as string,
    ],
  });

  return (
    <View style={style}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Animated.View
        style={[
          styles.wrap,
          {
            borderColor: interpolatedBorderColor,
          },
          isFocused && styles.wrapFocused,
          error && styles.wrapError,
        ]}
      >
        {leadingIcon && <View style={styles.leadingIcon}>{leadingIcon}</View>}
        <TextInput
          {...rest}
          placeholderTextColor={
            placeholderTextColor ?? AuroraColors.textMuted
          }
          style={[styles.input, inputStyle]}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {trailingIcon && <View style={styles.trailingIcon}>{trailingIcon}</View>}
      </Animated.View>
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: AuroraFont.sans,
    fontSize: AuroraFont.fsSm, // 13px
    fontWeight: AuroraFont.semibold,
    color: AuroraColors.textSecondary,
    marginBottom: 6,
    marginLeft: 2,
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AuroraColors.bgElevated, // rgba(255,255,255,0.92)
    borderWidth: 1.5,
    borderRadius: AuroraRadius.rMd, // 12
    paddingHorizontal: 16,
    minHeight: 52,
  },
  wrapFocused: {
    ...AuroraShadow.sm,
    shadowColor: AuroraColors.indigo500,
    shadowOpacity: 0.16,
  },
  wrapError: {
    borderColor: AuroraColors.rose500,
  },
  input: {
    flex: 1,
    fontFamily: AuroraFont.sans,
    fontSize: AuroraFont.fsMd, // 16
    color: AuroraColors.textPrimary,
    paddingVertical: 14,
  },
  leadingIcon: {
    marginRight: 10,
    marginLeft: 2,
  },
  trailingIcon: {
    marginLeft: 10,
    marginRight: 2,
  },
  hint: {
    fontFamily: AuroraFont.sans,
    fontSize: AuroraFont.fsXs, // 11
    color: AuroraColors.textMuted,
    marginTop: 4,
    marginLeft: 4,
  },
  errorText: {
    fontFamily: AuroraFont.sans,
    fontSize: AuroraFont.fsXs,
    color: AuroraColors.rose600,
    marginTop: 4,
    marginLeft: 4,
  },
});
