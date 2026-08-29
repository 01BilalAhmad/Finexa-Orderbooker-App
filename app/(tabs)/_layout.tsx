// =================================================================
// AURORA GLASS — TAB BAR
// Floating glassmorphic pill (16px margin from bottom)
//   • rgba(255,255,255,0.85) bg with backdrop blur
//   • subtle slate border, indigo-tinted lg shadow
//   • rounded corners (28px = r-2xl)
//   • active tab: indigo-600 color + white pill behind icon (pop anim)
// Matches HTML mockup (finexa-app-preview-v2.html) Aurora style
// =================================================================
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Animated } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraColors, AuroraFont, AuroraRadius, AuroraShadow } from '@/constants/auroraTheme';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const ACTIVE_COLOR = AuroraColors.indigo600; // #4F46E5
const INACTIVE_COLOR = AuroraColors.textMuted; // #94A3B8
// White with slight translucency — keeps glass effect on light backdrop
const BAR_BG = Platform.select({
  ios: 'rgba(255,255,255,0.78)', // glassmorphic on iOS
  android: 'rgba(255,255,255,0.92)', // brighter on Android (no blur support)
  default: '#FFFFFF',
}) as string;
const BAR_BORDER = AuroraColors.borderDefault; // rgba(148,163,184,0.24)

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

// Individual tab button — Animated scale on press, active icon
// gets a white glassmorphic pill behind it with a pop animation.
function TabButton({
  isFocused,
  label,
  iconName,
  onPress,
  onLongPress,
}: {
  isFocused: boolean;
  label: string;
  iconName: IconName;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Active icon pops up slightly larger and shifts up
    Animated.spring(iconScale, {
      toValue: isFocused ? 1.08 : 1,
      useNativeDriver: true,
      tension: 200,
      friction: 12,
    }).start();
  }, [isFocused, iconScale]);

  const handlePressIn = () => {
    Animated.timing(scale, { toValue: 0.92, duration: 90, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 12,
    }).start();
  };

  const iconColor = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR;
  const labelColor = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR;

  return (
    <Pressable
      style={styles.tabItem}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      android_ripple={{ color: 'rgba(79,70,229,0.08)', borderless: true, radius: 36 }}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
        <Animated.View
          style={[
            styles.iconWrap,
            isFocused && styles.iconWrapActive,
            { transform: [{ scale: iconScale }] },
          ]}
        >
          <MaterialIcons name={iconName} size={22} color={iconColor} />
        </Animated.View>
        <Text
          style={[
            styles.tabLabel,
            { color: labelColor },
            isFocused && styles.tabLabelActive,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // Floating pill: 16px from sides + dynamic bottom padding for safe area
  const bottomPad = Platform.select({
    ios: Math.max(insets.bottom, 8),
    android: 8,
    default: 8,
  });

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: bottomPad }]} pointerEvents="box-none">
      <View style={styles.tabBarInner}>
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
            <TabButton
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
      tabBar={(props) => <CustomTabBar {...props} />}
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
  // Outer container — invisible, only for padding/safe area
  tabBarContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 50,
  },
  // Inner pill — glassmorphic white with blur, indigo-tinted shadow
  tabBarInner: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: BAR_BG,
    borderWidth: 1,
    borderColor: BAR_BORDER,
    borderRadius: AuroraRadius.r2xl, // 28
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    ...AuroraShadow.lg,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Icon wrapper — gets white glassmorphic pill behind active icon
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: AuroraRadius.rMd, // 12
  },
  iconWrapActive: {
    backgroundColor: '#FFFFFF',
    ...AuroraShadow.sm,
    shadowColor: AuroraColors.indigo500,
    shadowOpacity: 0.20,
    shadowRadius: 8,
    elevation: 2,
    transform: [{ translateY: -2 }],
  },
  tabLabel: {
    fontSize: AuroraFont.fs2xs, // 10
    fontWeight: AuroraFont.semibold,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    fontWeight: AuroraFont.bold,
  },
});
