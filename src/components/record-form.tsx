import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  AppTextInput,
  BodyText,
  Button,
  Label,
  Panel,
} from '@/components/levelup-ui';
import { type GrowthCollection, type GrowthRecord, localDateString } from '@/lib/growth';
import { useLevelUpTheme } from '@/providers/levelup-theme-provider';

type FieldOption = { label: string; value: string };
type FieldSpec = {
  key: string;
  label: string;
  type?: 'text' | 'multiline' | 'number' | 'date' | 'url' | 'select' | 'boolean';
  required?: boolean;
  options?: FieldOption[];
  defaultValue?: string | number | boolean;
  placeholder?: string;
};

const select = (...values: string[]): FieldOption[] =>
  values.map((value) => ({
    value,
    label: value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
  }));

function mondayDateString() {
  const date = new Date();
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return localDateString(date);
}

const principleNames = [
  'Do Difficult Things Early',
  'Build in Public',
  'Surround Yourself with Achievers',
  'Improve One-on-One Communication',
  'Seek Practical Experiences',
  'Network and Build Connections',
  'Use Unfair Advantages',
];

const formFields: Record<GrowthCollection, FieldSpec[]> = {
  'daily-actions': [
    { key: 'title', label: 'Action', required: true },
    { key: 'description', label: 'What does done look like?', type: 'multiline' },
    { key: 'category', label: 'Area', type: 'select', required: true, options: select('dsa', 'cybersecurity', 'project', 'career', 'exercise', 'principle', 'other'), defaultValue: 'dsa' },
    { key: 'date', label: 'Planned date', type: 'date', required: true, defaultValue: localDateString() },
    { key: 'priority', label: 'Priority (1 is highest)', type: 'number', required: true, defaultValue: 1 },
    { key: 'status', label: 'Status', type: 'select', options: select('planned', 'attempted', 'completed', 'partial', 'not_completed'), defaultValue: 'planned' },
    { key: 'durationMinutes', label: 'Time spent (minutes)', type: 'number' },
    { key: 'reflection', label: 'Reflection', type: 'multiline' },
  ],
  'dsa-problems': [
    { key: 'title', label: 'Problem name', required: true },
    { key: 'topic', label: 'Topic', required: true, placeholder: 'For example, arrays or graphs' },
    { key: 'source', label: 'Source or sheet', placeholder: 'Enter the source you used' },
    { key: 'sourceUrl', label: 'Problem link', type: 'url' },
    { key: 'difficulty', label: 'Difficulty', type: 'select', options: select('unknown', 'easy', 'medium', 'hard'), defaultValue: 'unknown' },
    { key: 'sheetPosition', label: 'Sheet position', type: 'number' },
    { key: 'status', label: 'Status', type: 'select', options: select('not_started', 'attempted', 'solved_independently', 'solved_with_hints', 'solution_reviewed', 'needs_revision', 'mastered'), defaultValue: 'not_started' },
    { key: 'revisionDate', label: 'Next revision date', type: 'date' },
    { key: 'approach', label: 'Approach and notes', type: 'multiline' },
    { key: 'timeComplexity', label: 'Time complexity' },
    { key: 'spaceComplexity', label: 'Space complexity' },
    { key: 'mistakes', label: 'Mistakes to revisit', type: 'multiline' },
  ],
  'dsa-attempts': [
    { key: 'problemId', label: 'Problem ID', required: true, placeholder: 'Select or enter a saved problem ID' },
    { key: 'outcome', label: 'Outcome', type: 'select', required: true, options: select('independent', 'hints', 'solution_reviewed', 'revisit'), defaultValue: 'independent' },
    { key: 'durationMinutes', label: 'Attempt duration (minutes)', type: 'number' },
    { key: 'approach', label: 'Approach', type: 'multiline' },
    { key: 'timeComplexity', label: 'Time complexity' },
    { key: 'spaceComplexity', label: 'Space complexity' },
    { key: 'mistakes', label: 'Mistakes', type: 'multiline' },
    { key: 'revisionDate', label: 'Revision date', type: 'date' },
  ],
  'mock-tests': [
    { key: 'date', label: 'Test date', type: 'date', required: true, defaultValue: localDateString() },
    { key: 'source', label: 'Source or platform', required: true },
    { key: 'sourceUrl', label: 'Test link', type: 'url' },
    { key: 'questionCount', label: 'Total questions', type: 'number', required: true },
    { key: 'solved', label: 'Questions solved', type: 'number', required: true },
    { key: 'accuracy', label: 'Accuracy (%)', type: 'number' },
    { key: 'durationMinutes', label: 'Duration (minutes)', type: 'number' },
    { key: 'difficultTopics', label: 'Difficult topics', type: 'multiline' },
    { key: 'mistakes', label: 'Mistakes', type: 'multiline' },
    { key: 'lessons', label: 'Lessons', type: 'multiline' },
    { key: 'followUp', label: 'Follow-up revision', type: 'multiline' },
  ],
  learning: [
    { key: 'title', label: 'Topic or course', required: true },
    { key: 'topic', label: 'Roadmap area', required: true, placeholder: 'Networking, Linux, web security…' },
    { key: 'resource', label: 'Resource' },
    { key: 'resourceUrl', label: 'Resource link', type: 'url' },
    { key: 'startDate', label: 'Started', type: 'date' },
    { key: 'completionDate', label: 'Completed', type: 'date' },
    { key: 'plannedMinutes', label: 'Planned study minutes', type: 'number' },
    { key: 'actualMinutes', label: 'Actual study minutes', type: 'number' },
    { key: 'notes', label: 'Study notes', type: 'multiline' },
    { key: 'keyConcepts', label: 'Key concepts', type: 'multiline' },
    { key: 'nextRevisionDate', label: 'Next revision date', type: 'date' },
  ],
  labs: [
    { key: 'title', label: 'Lab or exercise', required: true },
    { key: 'platform', label: 'Legal training platform', required: true },
    { key: 'authorizedEnvironment', label: 'I own this system or have permission', type: 'boolean', required: true, defaultValue: false },
    { key: 'completed', label: 'Completed', type: 'boolean', defaultValue: false },
    { key: 'date', label: 'Date', type: 'date', required: true, defaultValue: localDateString() },
    { key: 'durationMinutes', label: 'Time spent (minutes)', type: 'number' },
    { key: 'notes', label: 'Notes', type: 'multiline' },
    { key: 'nextRevisionDate', label: 'Next review date', type: 'date' },
  ],
  projects: [
    { key: 'name', label: 'Project name', required: true },
    { key: 'problem', label: 'Problem being solved', type: 'multiline' },
    { key: 'technologies', label: 'Technologies' },
    { key: 'repositoryUrl', label: 'Repository URL', type: 'url' },
    { key: 'startDate', label: 'Start date', type: 'date' },
    { key: 'targetDate', label: 'Target date', type: 'date' },
    { key: 'stage', label: 'Current stage', type: 'select', options: select('idea', 'planning', 'development', 'testing', 'deployment', 'documentation', 'completed'), defaultValue: 'idea' },
    { key: 'deploymentUrl', label: 'Deployment URL', type: 'url' },
    { key: 'acceptanceCriteria', label: 'Acceptance criteria', type: 'multiline' },
    { key: 'testsCompleted', label: 'Tests completed', type: 'boolean', defaultValue: false },
    { key: 'documentationComplete', label: 'Documentation complete', type: 'boolean', defaultValue: false },
    { key: 'demoComplete', label: 'Demo complete', type: 'boolean', defaultValue: false },
    { key: 'lessons', label: 'Lessons learned', type: 'multiline' },
  ],
  milestones: [
    { key: 'projectId', label: 'Project ID', required: true },
    { key: 'title', label: 'Milestone', required: true },
    { key: 'dueDate', label: 'Due date', type: 'date' },
    { key: 'acceptanceCriteria', label: 'Acceptance criteria', type: 'multiline' },
    { key: 'status', label: 'Status', type: 'select', options: select('planned', 'in_progress', 'completed', 'missed'), defaultValue: 'planned' },
    { key: 'completedAt', label: 'Completed date', type: 'date' },
    { key: 'mvpComplete', label: 'Working MVP acceptance met', type: 'boolean', defaultValue: false },
    { key: 'polished', label: 'Polish acceptance met', type: 'boolean', defaultValue: false },
  ],
  applications: [
    { key: 'company', label: 'Company', required: true },
    { key: 'jobTitle', label: 'Job title', required: true },
    { key: 'jobUrl', label: 'Job description URL', type: 'url' },
    { key: 'platform', label: 'Application platform' },
    { key: 'status', label: 'Status', type: 'select', options: select('saved', 'ready_to_apply', 'applied', 'assessment', 'interview', 'offer', 'rejected', 'withdrawn', 'no_response'), defaultValue: 'saved' },
    { key: 'appliedDate', label: 'Actual submission date', type: 'date' },
    { key: 'deadline', label: 'Application deadline', type: 'date' },
    { key: 'recruiter', label: 'Recruiter contact' },
    { key: 'followUpDate', label: 'Follow-up date', type: 'date' },
    { key: 'assessmentDate', label: 'Assessment date', type: 'date' },
    { key: 'interviewRounds', label: 'Interview rounds completed', type: 'number' },
    { key: 'outcome', label: 'Outcome' },
    { key: 'notes', label: 'Notes', type: 'multiline' },
    { key: 'nextAction', label: 'Next action' },
  ],
  'principle-actions': [
    { key: 'principle', label: 'Principle number', type: 'select', required: true, options: Array.from({ length: 7 }, (_, index) => ({ value: String(index + 1), label: `${index + 1}. ${principleNames[index]}` })), defaultValue: 1 },
    { key: 'action', label: 'Specific action', required: true },
    { key: 'date', label: 'Date', type: 'date', required: true, defaultValue: localDateString() },
    { key: 'status', label: 'Status', type: 'select', options: select('planned', 'completed', 'partial', 'not_completed'), defaultValue: 'planned' },
    { key: 'evidenceUrl', label: 'Evidence or publication link', type: 'url' },
    { key: 'notes', label: 'Evidence or notes', type: 'multiline' },
    { key: 'reflection', label: 'Reflection', type: 'multiline' },
  ],
  exercise: [
    { key: 'activity', label: 'Activity', required: true, placeholder: 'Walk, stretching, strength training…' },
    { key: 'date', label: 'Date', type: 'date', required: true, defaultValue: localDateString() },
    { key: 'durationMinutes', label: 'Duration (minutes)', type: 'number', required: true, defaultValue: 0 },
    { key: 'status', label: 'Status', type: 'select', required: true, options: select('completed', 'partial', 'rest_day', 'not_completed') },
    { key: 'notes', label: 'Notes', type: 'multiline' },
  ],
  reflections: [
    { key: 'date', label: 'Date', type: 'date', required: true, defaultValue: localDateString() },
    { key: 'accountability', label: 'Did I take meaningful action?', type: 'select', required: true, options: select('completed', 'partial', 'not_completed') },
    { key: 'wentWell', label: 'What went well?', type: 'multiline' },
    { key: 'blockedProgress', label: 'What blocked progress?', type: 'multiline' },
    { key: 'changeTomorrow', label: 'What will I change tomorrow?', type: 'multiline' },
  ],
  challenges: [
    { key: 'startDate', label: 'Challenge start date', type: 'date', required: true, defaultValue: localDateString() },
  ],
  'weekly-reviews': [
    { key: 'weekOf', label: 'Week starting (Monday)', type: 'date', required: true, defaultValue: mondayDateString() },
    { key: 'wins', label: 'Wins backed by evidence', type: 'multiline' },
    { key: 'obstacles', label: 'Main obstacles', type: 'multiline' },
    { key: 'dsaReview', label: 'DSA review', type: 'multiline' },
    { key: 'learningReview', label: 'Learning review', type: 'multiline' },
    { key: 'projectsReview', label: 'Project review', type: 'multiline' },
    { key: 'careerReview', label: 'Career review', type: 'multiline' },
    { key: 'nextWeek', label: 'Next week priorities', type: 'multiline' },
  ],
  settings: [
    { key: 'weeklyReviewDay', label: 'Weekly application review day', type: 'select', required: true, options: select('friday', 'sunday'), defaultValue: 'friday' },
    { key: 'dailyStudyMinutes', label: 'Daily available study time', type: 'number', required: true, defaultValue: 120 },
    { key: 'cybersecurityTargetMinutes', label: 'Cybersecurity target minutes', type: 'number', required: true, defaultValue: 45 },
    { key: 'exerciseTargetDays', label: 'Exercise target days per week', type: 'number', required: true, defaultValue: 5 },
    { key: 'theme', label: 'Appearance', type: 'select', required: true, options: select('dark', 'light'), defaultValue: 'dark' },
  ],
};

function initialForm(fields: FieldSpec[], record?: GrowthRecord | null) {
  return Object.fromEntries(
    fields.map((field) => {
      const current = record?.[field.key];
      const initial =
        current !== undefined
          ? current
          : (field.defaultValue ?? (field.type === 'boolean' ? false : ''));
      return [field.key, String(initial)];
    }),
  );
}

export function RecordForm({
  collection,
  visible,
  record,
  initialValues,
  onClose,
  onSave,
  title,
}: {
  collection: GrowthCollection;
  visible: boolean;
  record?: GrowthRecord | null;
  initialValues?: Record<string, string | number | boolean>;
  onClose: () => void;
  onSave: (value: Record<string, unknown>) => Promise<void>;
  title?: string;
}) {
  const { colors } = useLevelUpTheme();
  const fields = formFields[collection];
  const defaultValues = useMemo(() => initialForm(fields, record), [fields, record]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const open = (nextVisible: boolean) => {
    if (nextVisible) {
      const next = { ...defaultValues };
      for (const [key, value] of Object.entries(initialValues ?? {})) next[key] = String(value);
      setValues(next);
      setError('');
    }
  };

  const save = async () => {
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = values[field.key] ?? '';
      if (field.type === 'boolean') {
        payload[field.key] = raw === 'true';
      } else if (field.type === 'number') {
        if (raw.trim() === '') {
          if (field.required) {
            setError(`${field.label} is required.`);
            return;
          }
        } else {
          const number = Number(raw);
          if (!Number.isFinite(number)) {
            setError(`${field.label} must be a number.`);
            return;
          }
          payload[field.key] = number;
        }
      } else if (raw.trim()) {
        payload[field.key] = field.key === 'principle' ? Number(raw) : raw.trim();
      } else if (field.required) {
        setError(`${field.label} is required.`);
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      await onSave(payload);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => open(true)}
      transparent={false}
      visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.modal, { backgroundColor: colors.background }]}>
        <View style={styles.modalHeader}>
          <View style={styles.modalTitle}>
            <Text style={[styles.title, { color: colors.text }]}>{title ?? (record ? 'Update record' : 'Log an action')}</Text>
            <BodyText>Saved to your private account. No progress is assumed.</BodyText>
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.secondary }]}>Close</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {fields.map((field) => {
            const value = values[field.key] ?? '';
            if (field.type === 'select') {
              return (
                <View key={field.key} style={styles.field}>
                  <Label>{field.label}</Label>
                  <View style={styles.options}>
                    {field.options?.map((option) => {
                      const selected = value === option.value;
                      return (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          key={option.value}
                          onPress={() => setValues((current) => ({ ...current, [field.key]: option.value }))}
                          style={[
                            styles.option,
                            {
                              backgroundColor: selected ? colors.accentSoft : colors.raised,
                              borderColor: selected ? colors.accent : colors.border,
                            },
                          ]}>
                          <Text style={{ color: selected ? colors.accent : colors.secondary, fontSize: 12, fontWeight: '700' }}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            }
            if (field.type === 'boolean') {
              const checked = value === 'true';
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  key={field.key}
                  onPress={() => setValues((current) => ({ ...current, [field.key]: String(!checked) }))}
                  style={styles.booleanField}>
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: checked ? colors.accent : colors.border, backgroundColor: checked ? colors.accentSoft : colors.raised },
                    ]}>
                    {checked ? <Text style={{ color: colors.accent, fontWeight: '900' }}>✓</Text> : null}
                  </View>
                  <Text style={{ color: colors.text, flex: 1, fontSize: 13, fontWeight: '600' }}>{field.label}</Text>
                </Pressable>
              );
            }
            return (
              <View key={field.key} style={styles.field}>
                <Label>{field.label}{field.required ? ' · required' : ''}</Label>
                <AppTextInput
                  autoCapitalize={field.type === 'url' ? 'none' : 'sentences'}
                  autoCorrect={field.type !== 'url'}
                  keyboardType={field.type === 'number' ? 'numeric' : field.type === 'url' ? 'url' : 'default'}
                  multiline={field.type === 'multiline'}
                  onChangeText={(text) => setValues((current) => ({ ...current, [field.key]: text }))}
                  placeholder={field.placeholder ?? (field.type === 'date' ? 'YYYY-MM-DD' : '')}
                  value={value}
                  style={field.type === 'multiline' ? styles.multiline : undefined}
                />
              </View>
            );
          })}
          {error ? (
            <Panel style={{ borderColor: colors.red }}>
              <Text style={{ color: colors.red, fontSize: 13, lineHeight: 19 }}>{error}</Text>
            </Panel>
          ) : null}
          <Button title={record ? 'Save changes' : 'Save record'} loading={saving} onPress={() => void save()} />
          {record ? (
            <BodyText>To remove a record, use the delete action on its card.</BodyText>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, paddingTop: Platform.OS === 'ios' ? 50 : 20 },
  modalHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between', padding: 20 },
  modalTitle: { flex: 1, gap: 4 },
  title: { fontSize: 23, fontWeight: '800' },
  closeButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 5 },
  closeText: { fontSize: 13, fontWeight: '700' },
  form: { alignSelf: 'center', gap: 15, maxWidth: 760, padding: 20, paddingBottom: 48, width: '100%' },
  field: { gap: 8 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderRadius: 99, borderWidth: 1, minHeight: 38, justifyContent: 'center', paddingHorizontal: 12 },
  booleanField: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 44 },
  checkbox: { alignItems: 'center', borderRadius: 7, borderWidth: 1, height: 24, justifyContent: 'center', width: 24 },
  multiline: { minHeight: 92, textAlignVertical: 'top' },
});
