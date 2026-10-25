import { GrowthListScreen } from '@/components/growth-list';

export default function ExerciseScreen() {
  return (
    <GrowthListScreen
      collection="exercise"
      title="Exercise"
      kicker="SUSTAINABLE WELLBEING"
      subtitle="Record movement in a way that fits your energy and life. Rest days are valid and are not treated as failures."
      emptyTitle="Start with what feels manageable"
      emptyMessage="Log a walk, stretch, workout, or planned rest day. No activity is assumed."
      fields={[
        { key: 'activity', label: 'Activity' },
        { key: 'date', label: 'Date' },
        { key: 'durationMinutes', label: 'Minutes' },
        { key: 'status', label: 'Status' },
        { key: 'notes', label: 'Notes' },
      ]}
    />
  );
}
