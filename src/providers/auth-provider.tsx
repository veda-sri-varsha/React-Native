import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  apiRequest,
  clearStoredSession,
  readStoredSession,
  storeSession,
  type SessionResponse,
  type User,
} from '@/lib/api';

type AuthContextValue = {
  ready: boolean;
  token: string | null;
  user: User | null;
  sessionNotice: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isSession(value: unknown): value is SessionResponse {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<SessionResponse>;
  return (
    typeof session.token === 'string' &&
    typeof session.user?.id === 'string' &&
    typeof session.user.name === 'string' &&
    typeof session.user.email === 'string'
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    setSession(null);
    try {
      await clearStoredSession();
      setSessionNotice(null);
    } catch {
      setSessionNotice(
        'Your session ended, but secure storage could not be cleared. Clear this app’s data before sharing this device.',
      );
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const stored = await readStoredSession();
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (isSession(parsed)) {
            if (mounted) setSession(parsed);
            try {
              const response = await apiRequest<{ user: User }>('/api/auth/me', parsed.token);
              if (mounted) setSession({ ...parsed, user: response.user });
            } catch (error) {
              if (error instanceof Error && 'status' in error && error.status === 401) {
                await clearStoredSession();
                if (mounted) setSession(null);
              }
            }
          } else {
            await clearStoredSession();
          }
        }
      } catch {
        if (mounted) {
          setSession(null);
          setSessionNotice('Secure sign-in storage could not be accessed. Sign in again to continue.');
        }
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const authenticate = useCallback(async (path: string, body: object) => {
    const result = await apiRequest<SessionResponse>(path, undefined, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!isSession(result)) throw new Error('The server returned an invalid session.');
    await storeSession(JSON.stringify(result));
    setSession(result);
    setSessionNotice(null);
  }, []);

  const signIn = useCallback(
    (email: string, password: string) =>
      authenticate('/api/auth/login', { email: email.trim(), password }),
    [authenticate],
  );

  const signUp = useCallback(
    (name: string, email: string, password: string) =>
      authenticate('/api/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
      }),
    [authenticate],
  );

  const request = useCallback(
    async <T,>(path: string, init: RequestInit = {}) => {
      if (!session) throw new Error('Your session has ended. Please sign in again.');
      try {
        return await apiRequest<T>(path, session.token, init);
      } catch (error) {
        if (error instanceof Error && 'status' in error && error.status === 401) {
          await signOut();
        }
        throw error;
      }
    },
    [session, signOut],
  );

  const value = useMemo(
    () => ({
      ready,
      token: session?.token ?? null,
      user: session?.user ?? null,
      sessionNotice,
      signIn,
      signUp,
      signOut,
      request,
    }),
    [ready, session, sessionNotice, signIn, signUp, signOut, request],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
