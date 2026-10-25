import { GrowthListScreen } from '@/components/growth-list';

export default function LearningScreen() {
  return (
    <GrowthListScreen
      collection="learning"
      title="Cybersecurity learning"
      kicker="STUDY · APPLY · REVISIT"
      subtitle="Keep a practical learning record with resources, notes, time spent, and upcoming revisions."
      emptyTitle="Create a learning log"
      emptyMessage="Add a topic you are studying. Only time you enter is counted in your progress."
      fields={[
        { key: 'title', label: 'Course or topic' },
        { key: 'topic', label: 'Roadmap area' },
        { key: 'resource', label: 'Resource' },
        { key: 'actualMinutes', label: 'Actual minutes' },
        { key: 'completionDate', label: 'Completed' },
        { key: 'nextRevisionDate', label: 'Next revision' },
        { key: 'keyConcepts', label: 'Key concepts' },
      ]}
    />
  );
}
