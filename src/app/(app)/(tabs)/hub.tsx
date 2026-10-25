import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen, BodyText, Heading, Panel, Row } from '@/components/levelup-ui';
import { useLevelUpTheme } from '@/providers/levelup-theme-provider';

const trackers = [
  { path: '/learning' as const, title: 'Cybersecurity learning', description: 'Courses, notes, resource links, and revision dates.' },
  { path: '/labs' as const, title: 'Authorized labs', description: 'Record practice in systems you own or have permission to use.' },
  { path: '/projects' as const, title: 'Projects and milestones', description: 'Build, test, document, and publish practical work.' },
  { path: '/principles' as const, title: 'Seven principles', description: 'Turn each principle into a specific action with evidence.' },
  { path: '/exercise' as const, title: 'Exercise and wellbeing', description: 'Track sustainable movement without guilt or streak pressure.' },
  { path: '/weekly-review' as const, title: 'Weekly reflection', description: 'Review wins, blockers, and next week’s priorities.' },
  { path: '/leads' as const, title: 'Lead inbox', description: 'Add and manage leads in your workspace.' },
  { path: '/settings' as const, title: 'Settings and privacy', description: 'Theme, schedule, data export, and account deletion.' },
];

export default function HubScreen() {
  const { colors } = useLevelUpTheme();
  return (
    <AppScreen
      title="Growth hub"
      kicker="YOUR TOOLS"
      subtitle="A home for the trackers behind the daily dashboard. Your activity is saved to your account.">
      <Panel style={styles.principles}>
        <Text style={[styles.number, { color: colors.accent }]}>90</Text>
        <View style={{ flex: 1, gap: 4 }}>
          <Heading>Progress over perfection</Heading>
          <BodyText>Use the tools that support you. You can start small, pause, or change your plan.</BodyText>
        </View>
      </Panel>
      <Heading>Trackers</Heading>
      <View style={styles.list}>
        {trackers.map((tracker) => (
          <Link href={tracker.path} asChild key={tracker.path}>
            <Pressable accessibilityRole="button">
              <Row label={tracker.title} value={tracker.description} />
            </Pressable>
          </Link>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  principles: { alignItems: 'center', flexDirection: 'row', gap: 18 },
  number: { fontSize: 42, fontWeight: '900', letterSpacing: -2 },
  list: { gap: 9 },
});
