import { useState } from 'react';
import { View } from 'react-native';

import { AppScreen, BodyText, Button, EmptyState, ErrorState, Heading, LoadingBlock } from '@/components/levelup-ui';
import { RecordCard } from '@/components/growth-list';
import { RecordForm } from '@/components/record-form';
import { type GrowthCollection, type GrowthRecord } from '@/lib/growth';
import { useGrowthCollection } from '@/hooks/use-growth-collection';

type FormState = {
  collection: GrowthCollection;
  record: GrowthRecord | null;
  initialValues?: Record<string, string | number | boolean>;
} | null;

export default function DsaScreen() {
  const problems = useGrowthCollection('dsa-problems');
  const attempts = useGrowthCollection('dsa-attempts');
  const tests = useGrowthCollection('mock-tests');
  const [form, setForm] = useState<FormState>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const openForm = (
    collection: GrowthCollection,
    record: GrowthRecord | null = null,
    initialValues?: Record<string, string | number | boolean>,
  ) => {
    setForm({ collection, record, initialValues });
    setError('');
  };

  const persist = async (value: Record<string, unknown>) => {
    if (!form) return;
    setSaving(true);
    setError('');
    try {
      if (form.record) {
        const selected =
          form.collection === 'dsa-problems' ? problems :
          form.collection === 'dsa-attempts' ? attempts : tests;
        await selected.update(form.record.id, value);
      } else {
        const selected =
          form.collection === 'dsa-problems' ? problems :
          form.collection === 'dsa-attempts' ? attempts : tests;
        await selected.create(value);
      }
      setForm(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the record.');
    } finally {
      setSaving(false);
    }
  };

  const anyLoading = problems.loading || attempts.loading || tests.loading;
  const firstError = problems.error || attempts.error || tests.error;

  return (
    <>
      <AppScreen
        title="DSA practice"
        kicker="THINK · ATTEMPT · REVIEW"
        subtitle="Track honest attempts and revisions. A problem is not marked solved until you record what actually happened."
        refreshing={problems.refreshing || attempts.refreshing || tests.refreshing}
        onRefresh={() => void Promise.all([problems.refresh(), attempts.refresh(), tests.refresh()])}>
        {firstError ? <ErrorState message={firstError} onRetry={() => void Promise.all([problems.refresh(), attempts.refresh(), tests.refresh()])} /> : null}
        {error ? <ErrorState message={error} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          <Button title="+ Problem" onPress={() => openForm('dsa-problems')} />
          <Button title="+ Mock test" secondary onPress={() => openForm('mock-tests')} />
        </View>

        <Heading>Problems</Heading>
        {anyLoading ? <LoadingBlock /> : problems.records.length ? (
          <View style={{ gap: 10 }}>
            {problems.records.map((problem) => (
              <RecordCard
                key={problem.id}
                record={problem}
                fields={[
                  { key: 'title', label: 'Problem' },
                  { key: 'topic', label: 'Topic' },
                  { key: 'difficulty', label: 'Difficulty' },
                  { key: 'status', label: 'Status' },
                  { key: 'revisionDate', label: 'Revision date' },
                ]}
                onAction={() => openForm('dsa-attempts', null, { problemId: problem.id })}
                actionLabel="Log attempt"
                onEdit={() => openForm('dsa-problems', problem)}
                onDelete={() => problems.remove(problem.id)}
              />
            ))}
          </View>
        ) : !firstError ? (
          <EmptyState title="Start a problem log" message="Save a problem with its topic and source, then record independent, assisted, or review attempts." action={{ label: 'Add a problem', onPress: () => openForm('dsa-problems') }} />
        ) : null}

        <Heading>Attempts</Heading>
        {attempts.records.length ? (
          <View style={{ gap: 10 }}>
            {attempts.records.slice(0, 12).map((attempt) => (
              <RecordCard
                key={attempt.id}
                record={attempt}
                fields={[
                  { key: 'problemId', label: 'Problem ID' },
                  { key: 'outcome', label: 'Outcome' },
                  { key: 'attemptedAt', label: 'Attempted' },
                  { key: 'durationMinutes', label: 'Minutes' },
                  { key: 'mistakes', label: 'Notes' },
                ]}
                onEdit={() => openForm('dsa-attempts', attempt)}
                onDelete={() => attempts.remove(attempt.id)}
              />
            ))}
          </View>
        ) : !anyLoading && !firstError ? (
          <BodyText>No attempts recorded yet. Use “Log attempt” from a saved problem.</BodyText>
        ) : null}

        <Heading>Mock tests</Heading>
        {tests.records.length ? (
          <View style={{ gap: 10 }}>
            {tests.records.map((test) => (
              <RecordCard
                key={test.id}
                record={test}
                fields={[
                  { key: 'source', label: 'Test' },
                  { key: 'date', label: 'Date' },
                  { key: 'solved', label: 'Solved' },
                  { key: 'questionCount', label: 'Questions' },
                  { key: 'accuracy', label: 'Accuracy %' },
                  { key: 'lessons', label: 'Lessons' },
                ]}
                onEdit={() => openForm('mock-tests', test)}
                onDelete={() => tests.remove(test.id)}
              />
            ))}
          </View>
        ) : !anyLoading && !firstError ? (
          <BodyText>Mock test scores will appear here after you record a test.</BodyText>
        ) : null}
      </AppScreen>

      {form ? (
        <RecordForm
          collection={form.collection}
          visible
          record={form.record}
          initialValues={form.initialValues}
          onClose={() => setForm(null)}
          onSave={persist}
          title={saving ? 'Saving…' : undefined}
        />
      ) : null}
    </>
  );
}
