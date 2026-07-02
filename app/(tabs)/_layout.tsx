// Powered by Finexa
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, FontWeight } from '@/constants/theme';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBarContainer,
        { paddingBottom: Platform.select({ ios: Math.max(insets.bottom, 8), android: 8, default: 8 }) },
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel || options.title || route.name;

        const getIconName = (routeName: string): React.ComponentProps<typeof MaterialIcons>['name'] => {
          switch (routeName) {
            case 'index': return 'route';
            case 'map': return 'map';
            case 'ledger': return 'menu-book';
            case 'profile': return 'person';
            default: return 'circle';
          }
        };

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
          <Pressable
            key={route.key}
            style={styles.tabItem}
            onPress={onPress}
            onLongPress={onLongPress}
            android_ripple={{ color: 'rgba(37,99,235,0.08)', borderless: true, radius: 40 }}
          >
            {/* Active indicator dot above the icon */}
            <View style={styles.dotWrap}>
              {isFocused ? <View style={styles.activeDot} /> : <View style={styles.dotPlaceholder} />}
            </View>

            <MaterialIcons
              name={getIconName(route.name)}
              size={22}
              color={isFocused ? Colors.primary : Colors.textMuted}
            />
            <Text style={[styles.tabLabel, isFocused ? styles.tabLabelActive : styles.tabLabelInactive]}>
              {label as string}
            </Text>
          </Pressable>
        );
      })}
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
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: 60,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  dotWrap: {
    height: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primary,
  },
  dotPlaceholder: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'transparent',
  },
  tabLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: Colors.primary,
  },
  tabLabelInactive: {
    color: Colors.textMuted,
  },
});
