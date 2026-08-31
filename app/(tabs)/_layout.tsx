// Powered by Finexa
// Bottom tab navigation — AURORA GLASS style (mockup .bottom-nav):
// floating glass pill (rgba white 0.85, 1px border, r-28, shadow-lg),
// nav items with 26px icon chips, active = indigo + card-bg icon chip,
// and a gradient center FAB raised above the bar (56px, glow, 4px page border).
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Animated } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AURORA, Colors, FontWeight, Shadow } from '@/constants/theme';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

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

// ── Nav item: icon chip + label, spring press, active = indigo + glass chip ──
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
  const iconLift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: isFocused ? 1.04 : 1,
        useNativeDriver: true,
        tension: 200,
        friction: 12,
      }),
      Animated.spring(iconLift, {
        toValue: isFocused ? -2 : 0, // nav-icon translateY(-2px) on active
        useNativeDriver: true,
        tension: 180,
        friction: 10,
      }),
    ]).start();
  }, [isFocused, scale, iconLift]);

  const handlePressIn = () => {
    Animated.timing(scale, { toValue: 0.92, duration: 90, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: isFocused ? 1.04 : 1,
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
      android_ripple={{ color: 'rgba(99,102,241,0.10)', borderless: true, radius: 40 }}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
        {/* nav-icon chip — active gets card bg (mockup .nav-item.active .nav-icon) */}
        <Animated.View
          style={[
            styles.navIcon,
            isFocused && styles.navIconActive,
            { transform: [{ translateY: iconLift }] },
          ]}
        >
          <MaterialIcons
            name={iconName}
            size={21}
            color={isFocused ? AURORA.chipText : Colors.tabInactive}
          />
        </Animated.View>
        <Text
          style={[
            styles.tabLabel,
            { color: isFocused ? Colors.primary : Colors.tabInactive },
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

// ── Gradient FAB (mockup .nav-fab): 56px circle centered on the pill's top edge ──
// Rendered as an overlay sibling of the pill (NOT inside it) so the raised
// half remains touchable on Android — the container reserves space above.
function NavFab({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

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

  return (
    // box-none wrapper: only the 56px FAB circle itself is touchable,
    // so the pill's tab buttons keep their full touch area.
    <View style={styles.fabOverlay} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel="New recovery"
        style={styles.fabSlot}
        android_ripple={{ color: 'rgba(99,102,241,0.14)', borderless: true, radius: 34 }}
      >
        <Animated.View style={[styles.fabWrap, { transform: [{ scale }] }]}>
          {/* glow halo behind the FAB (mockup .nav-fab::before) */}
          <View style={styles.fabGlow} pointerEvents="none" />
          <LinearGradient
            colors={['#4F46E5', '#7C3AED', '#6366F1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fab}
          >
            <MaterialIcons name="add" size={28} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </View>
  );
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.select({ ios: Math.max(insets.bottom, 10), android: 10, default: 10 });

  const handleFabPress = () => {
    // "New recovery" — go to the Route tab where shops can be collected
    const routeName = state.routes[0]?.name;
    if (routeName) {
      navigation.navigate(routeName);
    }
  };

  return (
    // Outer wrapper in page color — makes the pill look floating.
    // paddingTop reserves room for the raised FAB (28px above the pill top).
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

          // Reserve the center slot for the FAB between the 2nd and 3rd tab
          const items: React.ReactNode[] = [];
          if (index === 2) {
            items.push(<View key="fab-spacer" style={styles.fabSpacer} />);
          }
          items.push(
            <TabButton
              key={route.key}
              isFocused={isFocused}
              label={label}
              iconName={iconName}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
          return items;
        })}
      </View>
      {/* FAB overlay — centered over the pill's top edge */}
      <NavFab onPress={handleFabPress} />
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
  // Outer area in aurora page color so the pill floats.
  // paddingTop: 28 (FAB raise) + 6 (breathing room)
  tabBarContainer: {
    backgroundColor: AURORA.bgPage,
    paddingHorizontal: 16,
    paddingTop: 34,
  },
  // Glass pill bar (mockup .bottom-nav)
  tabBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    borderRadius: 28,
    backgroundColor: AURORA.bgPill,
    borderWidth: 1,
    borderColor: AURORA.borderDefault,
    paddingHorizontal: 8,
    ...Shadow.lg,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 16,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  // 26px icon chip (mockup .nav-icon)
  navIcon: {
    width: 26,
    height: 26,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconActive: {
    backgroundColor: AURORA.bgCard,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    marginTop: 1,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    fontWeight: FontWeight.bold,
  },
  // Center spacer where the FAB overlay sits
  fabSpacer: {
    width: 72,
    height: 64,
  },
  // FAB overlay — full-width strip, but only the 56px circle is touchable
  fabOverlay: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabSlot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Gradient FAB with 4px page border + glow (mockup .nav-fab)
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: AURORA.bgPage,
    ...Shadow.button,
  },
  fabGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 34,
    backgroundColor: 'rgba(99,102,241,0.35)',
    ...Shadow.glow,
  },
});
