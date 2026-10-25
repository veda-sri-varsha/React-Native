import { GrowthListScreen } from '@/components/growth-list';

export default function CareerScreen() {
  return (
    <GrowthListScreen
      collection="applications"
      title="Career pipeline"
      kicker="EVIDENCE · FOLLOW-UP · GROWTH"
      subtitle="Track real applications and actual submission dates. Planned targets are not counted as applications."
      emptyTitle="Your pipeline starts here"
      emptyMessage="Save opportunities, record the real application date, and track follow-ups and outcomes."
      fields={[
        { key: 'company', label: 'Company' },
        { key: 'jobTitle', label: 'Role' },
        { key: 'status', label: 'Status' },
        { key: 'appliedDate', label: 'Applied on' },
        { key: 'deadline', label: 'Deadline' },
        { key: 'followUpDate', label: 'Follow up' },
        { key: 'nextAction', label: 'Next action' },
        { key: 'outcome', label: 'Outcome' },
      ]}
    />
  );
}
