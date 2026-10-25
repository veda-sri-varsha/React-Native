import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SESSION_KEY = 'lead-management-session';
let webSession: string | null = null;

export type User = {
  id: string;
  name: string;
  email: string;
};

export type SessionResponse = {
  token: string;
  user: User;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getApiBaseUrl() {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!baseUrl) {
    if (Platform.OS === 'web') return 'http://localhost:3000';
    throw new ApiError(
      'Set EXPO_PUBLIC_API_URL to your computer’s LAN address and port 3000 before connecting.',
    );
  }
  return baseUrl;
}

export async function apiRequest<T>(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<T> {
  let url: string;
  try {
    url = `${getApiBaseUrl()}${path}`;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('The backend URL is not configured.');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError('Could not connect to the backend. Check your network and try again.');
  }

  if (response.status === 204) return undefined as T;

  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | T
    | null;
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'The request could not be completed.';
    throw new ApiError(message, response.status);
  }
  if (body === null) throw new ApiError('The server returned an invalid response.');
  return body as T;
}

export async function readStoredSession(): Promise<string | null> {
  return Platform.OS === 'web' ? webSession : SecureStore.getItemAsync(SESSION_KEY);
}

export async function storeSession(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    webSession = value;
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, value);
}

export async function clearStoredSession(): Promise<void> {
  if (Platform.OS === 'web') {
    webSession = null;
    return;
  }
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
