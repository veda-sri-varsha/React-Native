import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

import type { Lead } from '@/components/lead-card';
import { getApiBaseUrl } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

export type ConnectionState = 'connected' | 'disconnected';

function isLead(value: unknown): value is Lead {
  if (!value || typeof value !== 'object') return false;
  const lead = value as Partial<Lead>;
  return (
    typeof lead.id === 'string' &&
    typeof lead.receivedAt === 'string' &&
    typeof lead.status === 'string'
  );
}

export function useLeadSocket(onLead: (lead: Lead) => void): ConnectionState {
  const { token } = useAuth();
  const [connection, setConnection] = useState<ConnectionState>('disconnected');

  useEffect(() => {
    if (!token) return;
    let baseUrl: string;
    try {
      baseUrl = getApiBaseUrl();
    } catch {
      return;
    }

    const socket = io(baseUrl, {
      auth: { token },
      reconnection: true,
      reconnectionDelayMax: 10_000,
    });
    const handleLead = (payload: unknown) => {
      if (isLead(payload)) onLead(payload);
    };
    socket.on('connect', () => setConnection('connected'));
    socket.on('disconnect', () => setConnection('disconnected'));
    socket.on('connect_error', () => setConnection('disconnected'));
    socket.on('lead:new', handleLead);

    return () => {
      socket.off('lead:new', handleLead);
      socket.disconnect();
    };
  }, [onLead, token]);

  return connection;
}
