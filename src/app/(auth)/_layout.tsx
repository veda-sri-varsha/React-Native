import { Redirect, Stack } from 'expo-router';

import { LoadingState } from '@/components/crm-ui';
import { useAuth } from '@/providers/auth-provider';

export default function AuthLayout() {
  const { ready, user } = useAuth();
  if (!ready) return <LoadingState message="Restoring your session…" />;
  if (user) return <Redirect href="/today" />;
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
