import { Redirect, Stack } from 'expo-router';

import { LoadingState } from '@/components/crm-ui';
import { useAuth } from '@/providers/auth-provider';

export default function AppLayout() {
  const { ready, user } = useAuth();
  if (!ready) return <LoadingState message="Preparing your workspace…" />;
  if (!user) return <Redirect href="/login" />;
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="learning" />
      <Stack.Screen name="labs" />
      <Stack.Screen name="projects" />
      <Stack.Screen name="principles" />
      <Stack.Screen name="exercise" />
      <Stack.Screen name="weekly-review" />
      <Stack.Screen name="leads" />
    </Stack>
  );
}
