import { GrowthListScreen } from '@/components/growth-list';

export default function LabsScreen() {
  return (
    <GrowthListScreen
      collection="labs"
      title="Authorized labs"
      kicker="SAFE, PERMITTED PRACTICE"
      subtitle="Record cybersecurity practice only in systems you own or have explicit authorization to test."
      emptyTitle="No labs recorded"
      emptyMessage="Use an authorized training environment and state your permission before saving a record."
      fields={[
        { key: 'title', label: 'Lab' },
        { key: 'platform', label: 'Platform' },
        { key: 'authorizedEnvironment', label: 'Authorized' },
        { key: 'completed', label: 'Completed' },
        { key: 'date', label: 'Date' },
        { key: 'durationMinutes', label: 'Minutes' },
        { key: 'nextRevisionDate', label: 'Review date' },
        { key: 'notes', label: 'Notes' },
      ]}
    />
  );
}
