import { useState } from 'react';
import { View } from 'react-native';

import { AppScreen, BodyText, Button, EmptyState, ErrorState, Heading, LoadingBlock } from '@/components/levelup-ui';
import { RecordCard } from '@/components/growth-list';
import { RecordForm } from '@/components/record-form';
import { useGrowthCollection } from '@/hooks/use-growth-collection';
import { type GrowthCollection, type GrowthRecord } from '@/lib/growth';

type FormState = {
  collection: GrowthCollection;
  record: GrowthRecord | null;
  initialValues?: Record<string, string | number | boolean>;
} | null;

export default function ProjectsScreen() {
  const projects = useGrowthCollection('projects');
  const milestones = useGrowthCollection('milestones');
  const [form, setForm] = useState<FormState>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (value: Record<string, unknown>) => {
    if (!form) return;
    setSaving(true);
    setError('');
    try {
      const collection = form.collection === 'projects' ? projects : milestones;
      if (form.record) await collection.update(form.record.id, value);
      else await collection.create(value);
      setForm(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this record.');
    } finally {
      setSaving(false);
    }
  };

  const loading = projects.loading || milestones.loading;
  const loadError = projects.error || milestones.error;
  const openProject = (project: GrowthRecord) => {
    setForm({ collection: 'milestones', record: null, initialValues: { projectId: project.id } });
  };

  return (
    <>
      <AppScreen
        back
        title="Projects"
        kicker="BUILD · TEST · SHARE"
        subtitle="Create practical projects with real milestones. Completion is based on saved work, not assumed progress."
        refreshing={projects.refreshing || milestones.refreshing}
        onRefresh={() => void Promise.all([projects.refresh(), milestones.refresh()])}>
        {loadError ? <ErrorState message={loadError} onRetry={() => void Promise.all([projects.refresh(), milestones.refresh()])} /> : null}
        {error ? <ErrorState message={error} /> : null}
        <Button title="+ New project" onPress={() => setForm({ collection: 'projects', record: null })} />

        <Heading>Projects</Heading>
        {loading ? <LoadingBlock /> : projects.records.length ? (
          <View style={{ gap: 10 }}>
            {projects.records.map((project) => (
              <RecordCard
                key={project.id}
                record={project}
                fields={[
                  { key: 'name', label: 'Project' },
                  { key: 'stage', label: 'Stage' },
                  { key: 'targetDate', label: 'Target' },
                  { key: 'repositoryUrl', label: 'Repository' },
                  { key: 'id', label: 'Project ID' },
                ]}
                actionLabel="Add milestone"
                onAction={() => openProject(project)}
                onEdit={() => setForm({ collection: 'projects', record: project })}
                onDelete={() => projects.remove(project.id)}
              />
            ))}
          </View>
        ) : !loadError ? (
          <EmptyState title="Start with a small MVP" message="Save a project idea, then create testable milestones for the first working version." action={{ label: 'Create a project', onPress: () => setForm({ collection: 'projects', record: null }) }} />
        ) : null}

        <Heading>Milestones</Heading>
        {milestones.records.length ? (
          <View style={{ gap: 10 }}>
            {milestones.records.map((milestone) => (
              <RecordCard
                key={milestone.id}
                record={milestone}
                fields={[
                  { key: 'title', label: 'Milestone' },
                  { key: 'status', label: 'Status' },
                  { key: 'dueDate', label: 'Due date' },
                  { key: 'acceptanceCriteria', label: 'Acceptance criteria' },
                  { key: 'projectId', label: 'Project ID' },
                  { key: 'mvpComplete', label: 'MVP acceptance' },
                  { key: 'polished', label: 'Polish acceptance' },
                ]}
                onEdit={() => setForm({ collection: 'milestones', record: milestone })}
                onDelete={() => milestones.remove(milestone.id)}
              />
            ))}
          </View>
        ) : !loading && !loadError ? (
          <BodyText>Add a milestone from a saved project to keep it linked to that project.</BodyText>
        ) : null}
      </AppScreen>
      {form ? (
        <RecordForm
          collection={form.collection}
          visible
          record={form.record}
          initialValues={form.initialValues}
          onClose={() => setForm(null)}
          onSave={save}
          title={saving ? 'Saving…' : undefined}
        />
      ) : null}
    </>
  );
}
