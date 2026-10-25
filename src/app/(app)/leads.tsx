import { useCallback, useEffect, useState } from 'react';
import { Link } from 'expo-router';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
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
  const [formVisible, setFormVisible] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

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

  const addLead = async () => {
    setFormError('');
    if (!name.trim()) {
      setFormError('Enter the lead’s name.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setFormError('Enter an email address or phone number.');
      return;
    }
    setSaving(true);
    try {
      const result = await request<{ lead: Lead }>('/api/leads', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        }),
      });
      setLeads((current) =>
        current.some((item) => item.id === result.lead.id)
          ? current
          : [result.lead, ...current].slice(0, 100),
      );
      setName('');
      setEmail('');
      setPhone('');
      setFormVisible(false);
    } catch (saveError) {
      setFormError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

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
              <Text style={styles.emptyText}>Add a lead manually to start building your pipeline.</Text>
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
              {leads.length} {leads.length === 1 ? 'lead' : 'leads'} · Add and manage your contacts
            </Text>
            <Pressable accessibilityRole="button" onPress={() => { setFormError(''); setFormVisible(true); }} style={styles.addLeadButton}>
              <Text style={styles.addLeadButtonText}>+ Add lead</Text>
            </Pressable>
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
      <Modal
        animationType="slide"
        onRequestClose={() => setFormVisible(false)}
        transparent
        visible={formVisible}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add a lead</Text>
            <Text style={styles.formSubtitle}>Enter contact details you are authorized to store.</Text>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              accessibilityLabel="Lead name"
              autoCapitalize="words"
              onChangeText={setName}
              placeholder="Full name"
              style={styles.fieldInput}
              value={name}
            />
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              accessibilityLabel="Lead email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="name@example.com"
              style={styles.fieldInput}
              value={email}
            />
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              accessibilityLabel="Lead phone"
              keyboardType="phone-pad"
              onChangeText={setPhone}
              placeholder="Phone number"
              style={styles.fieldInput}
              value={phone}
            />
            {formError ? <Text accessibilityRole="alert" style={styles.formError}>{formError}</Text> : null}
            <View style={styles.formActions}>
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => setFormVisible(false)} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => void addLead()} style={styles.submitButton}>
                <Text style={styles.submitText}>{saving ? 'Saving…' : 'Save lead'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  addLeadButton: { alignSelf: 'flex-start', backgroundColor: CRM.primary, borderRadius: 12, marginTop: 10, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  addLeadButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
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
  modalBackdrop: { alignItems: 'center', backgroundColor: '#0008', flex: 1, justifyContent: 'center', padding: 20 },
  formCard: { backgroundColor: CRM.surface, borderColor: CRM.border, borderRadius: 20, borderWidth: 1, gap: 10, maxWidth: 480, padding: 22, width: '100%' },
  formTitle: { color: CRM.text, fontSize: 22, fontWeight: '800' },
  formSubtitle: { color: CRM.secondary, fontSize: 13, lineHeight: 19, marginBottom: 3 },
  fieldLabel: { color: CRM.text, fontSize: 12, fontWeight: '700' },
  fieldInput: { backgroundColor: '#fbfcfe', borderColor: CRM.border, borderRadius: 11, borderWidth: 1, color: CRM.text, fontSize: 15, minHeight: 46, paddingHorizontal: 13 },
  formError: { color: CRM.red, fontSize: 13, lineHeight: 19 },
  formActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 5 },
  cancelButton: { alignItems: 'center', borderRadius: 11, justifyContent: 'center', minHeight: 46, paddingHorizontal: 14 },
  cancelText: { color: CRM.secondary, fontSize: 14, fontWeight: '700' },
  submitButton: { alignItems: 'center', backgroundColor: CRM.primary, borderRadius: 11, justifyContent: 'center', minHeight: 46, paddingHorizontal: 16 },
  submitText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
});
