import { useCallback, useEffect, useState } from 'react';
import { Link } from 'expo-router';
import {
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LeadCard, type Lead } from '@/components/lead-card';
import { CRM, LoadingState, MessageCard } from '@/components/crm-ui';
import { useLeadSocket } from '@/hooks/use-lead-socket';
import { useAuth } from '@/providers/auth-provider';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Could not load leads. Please try again.';
}

export default function LeadsScreen() {
  const { request } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchLeads = useCallback(
    () => request<{ leads: Lead[] }>('/api/leads?limit=100'),
    [request],
  );
  const loadLeads = useCallback(async () => {
    try {
      const response = await fetchLeads();
      setLeads(response.leads);
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, [fetchLeads]);

  useEffect(() => {
    let active = true;
    void fetchLeads()
      .then((response) => {
        if (active) setLeads(response.leads);
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchLeads]);

  const refreshLeads = useCallback(() => {
    setRefreshing(true);
    setError('');
    void loadLeads().finally(() => setRefreshing(false));
  }, [loadLeads]);

  const onLead = useCallback((lead: Lead) => {
    setLeads((current) =>
      current.some((item) => item.id === lead.id)
        ? current
        : [lead, ...current].slice(0, 100),
    );
  }, []);
  useLeadSocket(onLead);

  if (loading && !leads.length) return <LoadingState message="Loading leads…" />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={[styles.content, !leads.length && styles.emptyContent]}
        data={leads}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyExtractor={(lead) => lead.id}
        ListEmptyComponent={
          error ? (
            <MessageCard title="Leads could not load" message={error} onRetry={refreshLeads} />
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyMark}>
                <Text style={styles.emptyMarkText}>L</Text>
              </View>
              <Text style={styles.emptyTitle}>No leads yet</Text>
              <Text style={styles.emptyText}>
                When a new lead arrives from Meta, it will appear here automatically.
              </Text>
            </View>
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Link href="/hub" asChild>
              <Pressable accessibilityRole="button" style={{ alignSelf: 'flex-start', paddingVertical: 8 }}>
                <Text style={styles.subtitle}>‹ Back to Growth</Text>
              </Pressable>
            </Link>
            <Text style={styles.eyebrow}>YOUR PIPELINE</Text>
            <Text style={styles.title}>Leads</Text>
            <Text style={styles.subtitle}>
              {leads.length} {leads.length === 1 ? 'lead' : 'leads'} · Updates in real time
            </Text>
            {error && leads.length ? (
              <MessageCard title="Could not refresh leads" message={error} onRetry={refreshLeads} />
            ) : null}
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshLeads} />
        }
        renderItem={({ item }) => <LeadCard lead={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: CRM.background, flex: 1 },
  content: { alignSelf: 'center', maxWidth: 760, padding: 20, width: '100%' },
  emptyContent: { flexGrow: 1 },
  header: { gap: 5, marginBottom: 20 },
  eyebrow: { color: CRM.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: CRM.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: CRM.secondary, fontSize: 14, marginTop: 2 },
  separator: { height: 10 },
  empty: { alignItems: 'center', flex: 1, gap: 10, justifyContent: 'center', paddingHorizontal: 28 },
  emptyMark: {
    alignItems: 'center',
    backgroundColor: CRM.paleBlue,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  emptyMarkText: { color: CRM.primary, fontSize: 25, fontWeight: '800' },
  emptyTitle: { color: CRM.text, fontSize: 18, fontWeight: '800', marginTop: 4 },
  emptyText: { color: CRM.secondary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
