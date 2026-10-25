import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppScreen,
  BodyText,
  Button,
  EmptyState,
  ErrorState,
  Heading,
  LoadingBlock,
  Panel,
} from '@/components/levelup-ui';
import { RecordForm } from '@/components/record-form';
import { type GrowthCollection, type GrowthRecord } from '@/lib/growth';
import { useGrowthCollection } from '@/hooks/use-growth-collection';
import { useLevelUpTheme } from '@/providers/levelup-theme-provider';

export type RecordField = { key: string; label: string };

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function RecordCard({
  record,
  fields,
  onEdit,
  onDelete,
  onAction,
  actionLabel,
}: {
  record: GrowthRecord;
  fields: RecordField[];
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
  onAction?: () => void;
  actionLabel?: string;
}) {
  const { colors } = useLevelUpTheme();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const titleField = fields[0];
  const title = titleField ? displayValue(record[titleField.key]) || titleField.label : 'Saved record';
  const details = fields.slice(1).flatMap((field) => {
    const value = displayValue(record[field.key]);
    return value ? [`${field.label}: ${value}`] : [];
  });

  const remove = async () => {
    if (!onDelete) return;
    setDeleting(true);
    setError('');
    try {
      await onDelete();
      setConfirmDelete(false);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete this record.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Panel>
      <View style={styles.cardHeading}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.recordDate, { color: colors.muted }]}>
          {record.updatedAt ? new Date(record.updatedAt).toLocaleDateString() : ''}
        </Text>
      </View>
      {details.length ? (
        <View style={styles.details}>
          {details.map((detail) => (
            <BodyText key={detail}>{detail}</BodyText>
          ))}
        </View>
      ) : null}
      {error ? <Text style={{ color: colors.red, fontSize: 12 }}>{error}</Text> : null}
      {confirmDelete ? (
        <View style={[styles.confirm, { backgroundColor: colors.redSoft }]}>
          <BodyText>This permanently deletes the record from your account.</BodyText>
          <View style={styles.actions}>
            <Button title="Keep it" secondary onPress={() => setConfirmDelete(false)} />
            <Button title="Delete" loading={deleting} onPress={() => void remove()} />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          {onAction ? <Button title={actionLabel ?? 'Log attempt'} secondary onPress={onAction} /> : null}
          {onEdit ? <Button title="Edit" secondary onPress={onEdit} /> : null}
          {onDelete ? (
            <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(true)} style={styles.deleteButton}>
              <Text style={{ color: colors.red, fontSize: 13, fontWeight: '700' }}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Panel>
  );
}

export function GrowthListScreen({
  collection,
  title,
  kicker,
  subtitle,
  emptyTitle,
  emptyMessage,
  fields,
}: {
  collection: GrowthCollection;
  title: string;
  kicker?: string;
  subtitle: string;
  emptyTitle: string;
  emptyMessage: string;
  fields: RecordField[];
}) {
  const { records, loading, refreshing, error, refresh, create, update, remove } = useGrowthCollection(collection);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<GrowthRecord | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormVisible(true);
  };
  const openEdit = (record: GrowthRecord) => {
    setEditing(record);
    setFormVisible(true);
  };
  const save = async (value: Record<string, unknown>) => {
    if (editing) await update(editing.id, value);
    else await create(value);
  };

  return (
    <>
      <AppScreen
        back
        title={title}
        kicker={kicker}
        subtitle={subtitle}
        action={{ label: `+ Add ${title.toLowerCase().replace(/s$/, '')}`, onPress: openCreate }}
        refreshing={refreshing}
        onRefresh={() => void refresh()}>
        {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : null}
        {loading ? <LoadingBlock /> : records.length ? (
          <View style={styles.list}>
            <Heading>{records.length} saved {records.length === 1 ? 'record' : 'records'}</Heading>
            {records.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                fields={fields}
                onEdit={() => openEdit(record)}
                onDelete={() => remove(record.id)}
              />
            ))}
          </View>
        ) : !error ? (
          <EmptyState title={emptyTitle} message={emptyMessage} action={{ label: 'Create your first record', onPress: openCreate }} />
        ) : null}
      </AppScreen>
      <RecordForm
        collection={collection}
        visible={formVisible}
        record={editing}
        onClose={() => setFormVisible(false)}
        onSave={save}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  cardHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', lineHeight: 22 },
  recordDate: { fontSize: 11, fontWeight: '600' },
  details: { gap: 4 },
  actions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  deleteButton: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 10 },
  confirm: { borderRadius: 12, gap: 10, padding: 12 },
});
