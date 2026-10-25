import { useState } from 'react';
import { View } from 'react-native';

import { AppScreen, BodyText, Button, EmptyState, ErrorState, Heading } from '@/components/levelup-ui';
import { RecordCard } from '@/components/growth-list';
import { RecordForm } from '@/components/record-form';
import { useGrowthCollection } from '@/hooks/use-growth-collection';
import { type GrowthCollection, type GrowthRecord } from '@/lib/growth';

export default function WeeklyReviewScreen() {
  const weekly = useGrowthCollection('weekly-reviews');
  const reflections = useGrowthCollection('reflections');
  const [collection, setCollection] = useState<GrowthCollection>('weekly-reviews');
  const [record, setRecord] = useState<GrowthRecord | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [error, setError] = useState('');
  const current = collection === 'weekly-reviews' ? weekly : reflections;

  const open = (kind: GrowthCollection, entry: GrowthRecord | null = null) => {
    setCollection(kind);
    setRecord(entry);
    setError('');
    setFormVisible(true);
  };

  const save = async (value: Record<string, unknown>) => {
    try {
      if (record) await current.update(record.id, value);
      else await current.create(value);
      setFormVisible(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your reflection.');
    }
  };

  const loading = weekly.loading || reflections.loading;
  const loadError = weekly.error || reflections.error;

  return (
    <>
      <AppScreen
        back
        title="Reflection"
        kicker="NOTICE · LEARN · CHOOSE"
        subtitle="Reflect without judgment. Honest notes help you decide what to change next."
        refreshing={weekly.refreshing || reflections.refreshing}
        onRefresh={() => void Promise.all([weekly.refresh(), reflections.refresh()])}>
        {loadError ? <ErrorState message={loadError} onRetry={() => void Promise.all([weekly.refresh(), reflections.refresh()])} /> : null}
        {error ? <ErrorState message={error} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          <Button title="+ Weekly review" onPress={() => open('weekly-reviews')} />
          <Button title="+ Daily reflection" secondary onPress={() => open('reflections')} />
        </View>
        <Heading>Weekly reviews</Heading>
        {weekly.records.length ? (
          <View style={{ gap: 10 }}>
            {weekly.records.map((entry) => (
              <RecordCard
                key={entry.id}
                record={entry}
                fields={[
                  { key: 'weekOf', label: 'Week of' },
                  { key: 'wins', label: 'Wins' },
                  { key: 'obstacles', label: 'Obstacles' },
                  { key: 'nextWeek', label: 'Next priorities' },
                ]}
                onEdit={() => open('weekly-reviews', entry)}
                onDelete={() => weekly.remove(entry.id)}
              />
            ))}
          </View>
        ) : !loading && !loadError ? (
          <EmptyState title="No weekly reviews yet" message="At the end of a week, record what happened and what you want to try next." />
        ) : null}
        <Heading>Daily reflections</Heading>
        {reflections.records.length ? (
          <View style={{ gap: 10 }}>
            {reflections.records.map((entry) => (
              <RecordCard
                key={entry.id}
                record={entry}
                fields={[
                  { key: 'date', label: 'Date' },
                  { key: 'accountability', label: 'Action taken' },
                  { key: 'wentWell', label: 'Went well' },
                  { key: 'blockedProgress', label: 'Blockers' },
                  { key: 'changeTomorrow', label: 'Tomorrow' },
                ]}
                onEdit={() => open('reflections', entry)}
                onDelete={() => reflections.remove(entry.id)}
              />
            ))}
          </View>
        ) : !loading && !loadError ? (
          <BodyText>No daily reflections saved.</BodyText>
        ) : null}
      </AppScreen>
      <RecordForm
        collection={collection}
        visible={formVisible}
        record={record}
        onClose={() => setFormVisible(false)}
        onSave={save}
      />
    </>
  );
}
