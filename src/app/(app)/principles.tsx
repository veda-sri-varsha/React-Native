import { GrowthListScreen } from '@/components/growth-list';

export default function PrinciplesScreen() {
  return (
    <GrowthListScreen
      collection="principle-actions"
      title="Seven principles"
      kicker="INTENTION → ACTION"
      subtitle="Translate each principle into a specific action. Treat evidence as optional context, not a measure of your worth."
      emptyTitle="Choose one principle to practice"
      emptyMessage="Record a concrete action and its actual status. Nothing is pre-completed."
      fields={[
        { key: 'principle', label: 'Principle number' },
        { key: 'action', label: 'Action' },
        { key: 'date', label: 'Date' },
        { key: 'status', label: 'Status' },
        { key: 'evidenceUrl', label: 'Evidence link' },
        { key: 'reflection', label: 'Reflection' },
      ]}
    />
  );
}
