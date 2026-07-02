// Powered by Finexa
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Animated } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontSize, FontWeight } from '@/constants/theme';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

// Modern Blue tab bar palette
const ACTIVE_COLOR = '#2563EB';
const INACTIVE_COLOR = '#94A3B8';
const BAR_BG = '#FFFFFF';
const BAR_BORDER = '#E2E8F0';

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

// Individual tab button — uses Animated scale on press, active dot above icon,
// blue active / gray inactive theming.
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

  // Spring into a slightly larger scale when the tab becomes focused
  useEffect(() => {
    Animated.spring(scale, {
      toValue: isFocused ? 1.08 : 1,
      useNativeDriver: true,
      tension: 200,
      friction: 12,
    }).start();
  }, [isFocused]);

  const handlePressIn = () => {
    Animated.timing(scale, { toValue: 0.92, duration: 90, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: isFocused ? 1.08 : 1,
      useNativeDriver: true,
      tension: 200,
      friction: 12,
    }).start();
  };

  return (
    <Pressable
      style={styles.tabItem}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      android_ripple={{ color: 'rgba(37,99,235,0.08)', borderless: true, radius: 36 }}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
        {/* Active indicator dot above the icon */}
        <View style={styles.dotWrap}>
          {isFocused ? <View style={styles.activeDot} /> : <View style={styles.dotPlaceholder} />}
        </View>

        <MaterialIcons
          name={iconName}
          size={22}
          color={isFocused ? ACTIVE_COLOR : INACTIVE_COLOR}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: isFocused ? ACTIVE_COLOR : INACTIVE_COLOR },
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
  const bottomPad = Platform.select({ ios: Math.max(insets.bottom, 8), android: 8, default: 8 });

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: bottomPad }]}>
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
        options={{
          title: 'Route',
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
        }}
      />
      <Tabs.Screen
        name="ledger"
        options={{
          title: 'Ledger',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    backgroundColor: BAR_BG,
    borderTopWidth: 1,
    borderTopColor: BAR_BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 10 },
    }),
  },
  tabBarInner: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'stretch',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotWrap: {
    height: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: ACTIVE_COLOR,
  },
  dotPlaceholder: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'transparent',
  },
  tabLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    fontWeight: FontWeight.bold,
  },
});
