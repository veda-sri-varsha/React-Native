import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BodyText,
  Button,
  EmptyState,
  ErrorState,
  Heading,
  LoadingBlock,
  Panel,
  ProgressBar,
  StatCard,
} from '@/components/levelup-ui';
import { RecordCard } from '@/components/growth-list';
import { RecordForm } from '@/components/record-form';
import { createGrowthRecord, getAssistantPlan, getGrowthDashboard, localDateString, type AssistantPlan, type GrowthCollection, type GrowthDashboard, type GrowthRecord } from '@/lib/growth';
import { useGrowthCollection } from '@/hooks/use-growth-collection';
import { useAuth } from '@/providers/auth-provider';
import { useLevelUpTheme } from '@/providers/levelup-theme-provider';

export default function TodayScreen() {
  const { token, user } = useAuth();
  const { colors } = useLevelUpTheme();
  const {
    records: actions,
    loading: actionsLoading,
    error: actionsError,
    refresh: refreshActions,
    create,
    update,
    remove,
  } = useGrowthCollection('daily-actions');
  const [dashboard, setDashboard] = useState<GrowthDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [formCollection, setFormCollection] = useState<GrowthCollection>('daily-actions');
  const [editing, setEditing] = useState<GrowthRecord | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState('');
  const [plan, setPlan] = useState<AssistantPlan | null>(null);
  const [savingSuggestion, setSavingSuggestion] = useState('');
  const todaysActions = actions.filter((action) => action.date === localDateString());

  const load = useCallback(async () => {
    if (!token) throw new Error('Your session has ended. Please sign in again.');
    const result = await getGrowthDashboard(token);
    setDashboard(result);
    setError('');
  }, [token]);

  useEffect(() => {
    let active = true;
    if (!token) return () => { active = false; };
    void getGrowthDashboard(token)
      .then((result) => {
        if (active) setDashboard(result);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load your dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([load(), refreshActions()]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not refresh the dashboard.');
    } finally {
      setRefreshing(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormCollection('daily-actions');
    setFormVisible(true);
  };

  const saveAction = async (value: Record<string, unknown>) => {
    if (formCollection === 'challenges') {
      if (!token) throw new Error('Your session has ended. Please sign in again.');
      await createGrowthRecord('challenges', value, token);
    } else if (editing) {
      await update(editing.id, value);
    } else {
      await create(value);
    }
    await load();
  };

  const requestPlan = async () => {
    if (!token) return;
    setAssistantLoading(true);
    setAssistantError('');
    try {
      setPlan(await getAssistantPlan(token, localDateString(), undefined));
    } catch (planError) {
      setAssistantError(planError instanceof Error ? planError.message : 'Could not create a suggested plan.');
    } finally {
      setAssistantLoading(false);
    }
  };

  const acceptSuggestion = async (suggestion: string) => {
    setSavingSuggestion(suggestion);
    try {
      await create({
        title: suggestion,
        category: 'other',
        date: localDateString(),
        priority: 2,
        status: 'planned',
      });
      await load();
    } catch (saveError) {
      setAssistantError(saveError instanceof Error ? saveError.message : 'Could not save that action.');
    } finally {
      setSavingSuggestion('');
    }
  };

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (loading && !dashboard) return <LoadingBlock message="Loading your real progress…" />;

  return (
    <>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accent} />}>
          <View style={styles.header}>
            <View style={styles.greeting}>
              <Text style={[styles.date, { color: colors.secondary }]}>{dateLabel}</Text>
              <Text style={[styles.title, { color: colors.text }]}>Welcome back, {user?.name ?? 'there'}.</Text>
              <Text style={[styles.subtitle, { color: colors.secondary }]}>Build a little momentum, one honest day at a time.</Text>
            </View>
            <View style={[styles.online, { backgroundColor: error || actionsError ? colors.redSoft : colors.greenSoft }]}>
            <View style={[styles.dot, { backgroundColor: error || actionsError ? colors.red : colors.green }]} />
            <Text style={{ color: error || actionsError ? colors.red : colors.green, fontSize: 11, fontWeight: '800' }}>
              {error || actionsError ? 'OFFLINE' : 'SYNCED'}
              </Text>
            </View>
          </View>

          {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : null}
          {actionsError ? <ErrorState message={actionsError} onRetry={() => void refreshActions()} /> : null}

          <Panel style={styles.challenge}>
            <View style={styles.challengeHeading}>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={[styles.eyebrow, { color: colors.accent }]}>YOUR 90-DAY CHALLENGE</Text>
                <Heading>
                  {dashboard?.challenge
                    ? dashboard.challenge.completed
                      ? 'Challenge complete'
                      : `Day ${dashboard.challenge.day} of 90`
                    : 'Start when you are ready'}
                </Heading>
                <BodyText>
                  {dashboard?.challenge
                    ? `Phase ${dashboard.challenge.phase} · ${dashboard.challenge.daysRemaining} days remaining`
                    : 'Set a start date to track the challenge. No progress is pre-filled.'}
                </BodyText>
              </View>
              {!dashboard?.challenge ? (
                <Button title="Set start date" secondary onPress={() => { setEditing(null); setFormCollection('challenges'); setFormVisible(true); }} />
              ) : null}
            </View>
            {dashboard?.challenge ? (
              <ProgressBar value={dashboard.challenge.progressPercent} label={`${dashboard.challenge.progressPercent}% elapsed`} />
            ) : null}
          </Panel>

          <View style={styles.stats}>
            <StatCard label="Today’s actions" value={dashboard?.plannedActions ?? 0} hint={`${dashboard?.completedActions ?? 0} completed`} />
            <StatCard label="Completion" value={dashboard?.completionPercent == null ? '—' : `${dashboard.completionPercent}%`} hint="Based on your plan" accent />
            <StatCard label="DSA reviews due" value={dashboard?.dsa.revisionBacklog ?? 0} hint="Saved problems to revisit" />
          </View>

          <View style={styles.sectionHeader}>
            <Heading>Today’s plan</Heading>
            <Text style={[styles.muted, { color: colors.muted }]}>{todaysActions.length} saved actions</Text>
          </View>
          <Button title="+ Add an action" onPress={openCreate} />
            {actionsLoading ? (
              <LoadingBlock message="Loading today’s actions…" />
            ) : todaysActions.length ? (
            <View style={styles.list}>
                {todaysActions.map((action) => (
                <RecordCard
                  key={action.id}
                  record={action}
                  fields={[
                    { key: 'title', label: 'Action' },
                    { key: 'category', label: 'Area' },
                    { key: 'status', label: 'Status' },
                    { key: 'priority', label: 'Priority' },
                  ]}
                  onEdit={() => { setEditing(action); setFormVisible(true); }}
                  onDelete={async () => { await remove(action.id); await load(); }}
                />
              ))}
            </View>
          ) : (
            <EmptyState title="Nothing planned for today" message="Add actions that fit your real schedule. Empty days are not counted as failures." />
          )}

          <Panel>
            <View style={styles.sectionHeader}>
              <Heading>Planning assistant</Heading>
              <Text style={[styles.eyebrow, { color: colors.accent }]}>{plan?.mode === 'ai' ? 'AI SUGGESTIONS' : 'PRIVATE BY DEFAULT'}</Text>
            </View>
            <BodyText>Suggestions use your saved records and study-time preference. When an AI provider is configured, relevant planning context is sent to that provider. Suggestions never change your plan unless you choose to add one.</BodyText>
            <Button title="Suggest a realistic plan" secondary loading={assistantLoading} onPress={() => void requestPlan()} />
            {assistantError ? <Text style={{ color: colors.red, fontSize: 13 }}>{assistantError}</Text> : null}
            {plan ? (
              <View style={styles.list}>
                {plan.warning ? <BodyText>{plan.warning}</BodyText> : null}
                <BodyText>{plan.summary}</BodyText>
                {plan.suggestions.map((suggestion) => (
                  <Panel key={suggestion} style={{ borderColor: colors.accent }}>
                    <BodyText>{suggestion}</BodyText>
                    <Button
                      title="Add this suggestion to today"
                      secondary
                      loading={savingSuggestion === suggestion}
                      onPress={() => void acceptSuggestion(suggestion)}
                    />
                  </Panel>
                ))}
              </View>
            ) : null}
          </Panel>

          <Panel>
            <Heading>Recent activity</Heading>
            {dashboard?.recentActions.length ? (
              dashboard.recentActions.map((action) => (
                <BodyText key={action.id}>
                  {String(action.date)} · {String(action.title)} · {String(action.status)}
                </BodyText>
              ))
            ) : (
              <BodyText>As you log actions, a real activity history will show here.</BodyText>
            )}
          </Panel>
        </ScrollView>
      </SafeAreaView>
      <RecordForm
        collection={formCollection}
        visible={formVisible}
        record={editing}
        onClose={() => setFormVisible(false)}
        onSave={saveAction}
        title={formCollection === 'challenges' ? 'Set your challenge start' : undefined}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { alignSelf: 'center', gap: 17, maxWidth: 760, padding: 20, paddingBottom: 40, width: '100%' },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  greeting: { flex: 1, gap: 5 },
  date: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  online: { alignItems: 'center', borderRadius: 99, flexDirection: 'row', gap: 6, paddingHorizontal: 9, paddingVertical: 7 },
  dot: { borderRadius: 4, height: 7, width: 7 },
  challenge: { gap: 15 },
  challengeHeading: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  muted: { fontSize: 11, fontWeight: '600' },
  list: { gap: 10 },
});
