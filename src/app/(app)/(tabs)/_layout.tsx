import { Tabs } from 'expo-router';

import { useLevelUpTheme } from '@/providers/levelup-theme-provider';

export default function GrowthTabsLayout() {
  const { colors } = useLevelUpTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62,
          paddingBottom: 7,
          paddingTop: 7,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}>
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="dsa" options={{ title: 'DSA' }} />
      <Tabs.Screen name="hub" options={{ title: 'Growth' }} />
      <Tabs.Screen name="career" options={{ title: 'Career' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
    </Tabs>
  );
}
