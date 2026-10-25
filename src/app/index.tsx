import { Redirect } from 'expo-router';

import { LoadingState } from '@/components/crm-ui';
import { useAuth } from '@/providers/auth-provider';

export default function IndexScreen() {
  const { ready, user } = useAuth();
  if (!ready) return <LoadingState message="Preparing your workspace…" />;
  return <Redirect href={user ? '/today' : '/login'} />;
}
