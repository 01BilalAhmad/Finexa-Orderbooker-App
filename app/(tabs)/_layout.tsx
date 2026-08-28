// ═══════════════════════════════════════════════════════════════════════════
//  Aurora Glass Tab Bar — glassmorphic floating bar with neon indigo glow
//  Uses Reanimated 4 worklets (replaces inline Animated API — fixes weakness #15)
// ═══════════════════════════════════════════════════════════════════════════
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
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
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { AuroraColors, AuroraFont, AuroraRadius, AuroraSpacing, AuroraGradients, AuroraShadow } from '@/constants/auroraTheme';
import { LinearGradient } from 'expo-linear-gradient';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

function getIconName(routeName: string): IconName {
  switch (routeName) {
    case 'index': return 'route';
    case 'map': return 'map';
    case 'ledger': return 'menu-book';
    case 'profile': return 'person';
    default: return 'circle';
  }
}

interface TabButtonProps {
  isFocused: boolean;
  label: string;
  iconName: IconName;
  onPress: () => void;
  onLongPress: () => void;
}

/**
 * AuroraGlassTabButton — uses Reanimated 4 worklets for native UI-thread animations
 * Replaces the old inline Animated.spring / Animated.timing pattern (weakness #15)
 */
function AuroraGlassTabButton({
  isFocused,
  label,
  iconName,
  onPress,
  onLongPress,
}: TabButtonProps) {
  // Shared values — driven by Reanimated worklets on UI thread
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const indicatorHeight = useSharedValue(0);

  // Spring into focus state when active tab changes
  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.10 : 1, {
      damping: 14,
      stiffness: 280,
    });
    glowOpacity.value = withTiming(isFocused ? 0.55 : 0, {
      duration: 220,
      easing: Easing.out(Easing.ease),
    });
    indicatorHeight.value = withSpring(isFocused ? 4 : 0, {
      damping: 12,
      stiffness: 320,
    });
  }, [isFocused, scale, glowOpacity, indicatorHeight]);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handlePressIn = () => {
    scale.value = withSpring(0.92, {
      damping: 15,
      stiffness: 400,
    });
    runOnJS(triggerHaptic)();
  };

  const handlePressOut = () => {
    scale.value = withSpring(isFocused ? 1.10 : 1, {
      damping: 12,
      stiffness: 280,
    });
  };

  // Animated styles — these run on UI thread via Reanimated 4 worklets
  const animatedIcon = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedGlow = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const animatedIndicator = useAnimatedStyle(() => ({
    height: indicatorHeight.value,
  }));

  return (
    <Pressable
      style={styles.tabItem}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      android_ripple={{ color: 'rgba(167, 139, 250, 0.12)', borderless: true, radius: 36 }}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={label}
    >
      <View style={styles.tabInner}>
        {/* Neon glow indicator (top) */}
        <View style={styles.indicatorWrap}>
          <Animated.View
            style={[styles.indicatorGlow, animatedGlow, animatedIndicator]}
          />
        </View>

        {/* Icon with scale animation */}
        <Animated.View style={[styles.iconWrap, animatedIcon]}>
          {isFocused ? (
            // Filled icon style when active — gives a "selected" feel
            <LinearGradient
              colors={[...AuroraGradients.tabIndicator]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.iconBg}
            >
              <MaterialIcons
                name={iconName}
                size={20}
                color="#FFFFFF"
              />
            </LinearGradient>
          ) : (
            <MaterialIcons
              name={iconName}
              size={22}
              color={AuroraColors.tabInactive}
            />
          )}
        </Animated.View>

        {/* Label */}
        <Text
          style={[
            styles.tabLabel,
            { color: isFocused ? AuroraColors.tabActive : AuroraColors.tabInactive },
            isFocused && styles.tabLabelActive,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function AuroraGlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.select({
    ios: Math.max(insets.bottom, 8),
    android: 12,
    default: 12,
  });

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: bottomPad }]}>
      {/* iOS: true glassmorphic blur; Android: simulated translucent */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={80}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={StyleSheet.absoluteFill} />
      )}

      {/* Inner border + content */}
      <View style={styles.tabBarInner}>
        {/* Top hairline border with subtle indigo glow */}
        <View style={styles.topBorder} pointerEvents="none" />

        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];
          const label = (options.tabBarLabel || options.title || route.name) as string;
          const iconName = getIconName(route.name);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <AuroraGlassTabButton
              key={route.key}
              isFocused={isFocused}
              label={label}
              iconName={iconName}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <AuroraGlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Route' }}
      />
      <Tabs.Screen
        name="map"
        options={{ title: 'Map' }}
      />
      <Tabs.Screen
        name="ledger"
        options={{ title: 'Ledger' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile' }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: AuroraColors.tabBarBg,  // translucent dark
    borderTopWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  tabBarInner: {
    flexDirection: 'row',
    height: 68,
    alignItems: 'stretch',
    paddingHorizontal: AuroraSpacing.sm,
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: AuroraColors.glassBorder,
    shadowColor: AuroraColors.neonIndigo,
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: AuroraSpacing.sm,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  indicatorWrap: {
    height: 4,
    width: 24,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  indicatorGlow: {
    width: 4,
    borderRadius: 2,
    backgroundColor: AuroraColors.neonViolet,
    shadowColor: AuroraColors.neonIndigo,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...AuroraShadow.neon,
  },
  tabLabel: {
    fontSize: AuroraFont.size.xs,
    fontWeight: AuroraFont.weight.medium,
    letterSpacing: AuroraFont.tracking.wide,
    marginTop: 2,
  },
  tabLabelActive: {
    fontWeight: AuroraFont.weight.bold,
    color: AuroraColors.tabActive,
  },
});
