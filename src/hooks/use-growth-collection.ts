import { useCallback, useEffect, useState } from 'react';

import {
  createGrowthRecord,
  deleteGrowthRecord,
  listGrowthRecords,
  updateGrowthRecord,
  type GrowthCollection,
  type GrowthRecord,
} from '@/lib/growth';
import { useAuth } from '@/providers/auth-provider';

export function useGrowthCollection(collection: GrowthCollection) {
  const { token } = useAuth();
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) throw new Error('Sign in to access your saved records.');
    return listGrowthRecords(collection, token);
  }, [collection, token]);

  useEffect(() => {
    let active = true;
    void load()
      .then((result) => {
        if (active) setRecords(result);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load records.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      setRecords(await load());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not refresh records.');
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const create = useCallback(
    async (value: Record<string, unknown>) => {
      if (!token) throw new Error('Sign in to save records.');
      const record = await createGrowthRecord(collection, value, token);
      setRecords((current) => [record, ...current]);
      setError('');
      return record;
    },
    [collection, token],
  );

  const update = useCallback(
    async (id: string, value: Record<string, unknown>) => {
      if (!token) throw new Error('Sign in to update records.');
      const record = await updateGrowthRecord(collection, id, value, token);
      setRecords((current) => current.map((item) => (item.id === id ? record : item)));
      return record;
    },
    [collection, token],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!token) throw new Error('Sign in to delete records.');
      await deleteGrowthRecord(collection, id, token);
      setRecords((current) => current.filter((item) => item.id !== id));
    },
    [collection, token],
  );

  return { records, loading, refreshing, error, refresh, create, update, remove };
}
