import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppScreen, BodyText, EmptyState, ErrorState, Heading, LoadingBlock, Panel, ProgressBar, StatCard } from '@/components/levelup-ui';
import { getGrowthAnalytics, type GrowthAnalytics } from '@/lib/growth';
import { useAuth } from '@/providers/auth-provider';

export default function ProgressScreen() {
  const { token } = useAuth();
  const [data, setData] = useState<GrowthAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) throw new Error('Your session has ended. Please sign in again.');
    setData(await getGrowthAnalytics(token));
    setError('');
  }, [token]);

  useEffect(() => {
    let active = true;
    if (!token) return () => { active = false; };
    void getGrowthAnalytics(token)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load saved analytics.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [token]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not refresh analytics.');
    } finally {
      setRefreshing(false);
    }
  };

  const hasRecords = data?.daily.some((day) => day.plannedActions || day.dsaAttempts || day.exerciseMinutes || day.applications) ??
    Boolean(data?.learningMinutes || data?.labCount || data?.projectMilestones.length || data?.mockTests.length);

  return (
    <AppScreen
      title="Progress"
      kicker="30-DAY SNAPSHOT"
      subtitle={data ? `Daily activity: ${data.period.from} to ${data.period.to}. Other totals use all saved records.` : 'Trends only appear after you record activity.'}
      refreshing={refreshing}
      onRefresh={() => void refresh()}>
      {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : null}
      {loading && !data ? <LoadingBlock /> : data ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <StatCard label="Learning minutes · all time" value={data.learningMinutes} hint="Recorded study time" />
            <StatCard label="Labs · all time" value={data.labCount} hint="Completed authorized practice" accent />
            <StatCard label="Mock tests · all time" value={data.mockTests.length} hint="Saved test results" />
          </View>

          {!hasRecords ? (
            <EmptyState title="No progress data yet" message="Your dashboard starts with your records—not sample scores. Log a real study session, action, test, or workout to see trends." />
          ) : null}

          <Panel>
            <Heading>Recent days</Heading>
            <BodyText>Days without a plan are left blank, not scored as zero.</BodyText>
            {data.daily.slice(-7).map((day) => (
              <View key={day.date} style={{ gap: 6 }}>
                <BodyText>
                  {day.date} · {day.plannedActions ? `${day.completedActions}/${day.plannedActions} actions` : 'No plan'}
                  {' · '}{day.dsaAttempts} DSA attempts · {day.exerciseMinutes} exercise min
                </BodyText>
                {day.completionPercent !== null ? <ProgressBar value={day.completionPercent} /> : null}
              </View>
            ))}
          </Panel>

          <Panel>
            <Heading>DSA by topic</Heading>
            {data.dsaTopics.length ? data.dsaTopics.map((topic) => (
              <View key={topic.topic} style={{ gap: 5 }}>
                <BodyText>{topic.topic} · {topic.mastered} mastered of {topic.tracked} tracked</BodyText>
                <ProgressBar value={topic.tracked ? (topic.mastered / topic.tracked) * 100 : 0} />
              </View>
            )) : <BodyText>Save DSA problems by topic to see topic coverage.</BodyText>}
          </Panel>

          <Panel>
            <Heading>Career pipeline</Heading>
            {data.applicationStatuses.length ? data.applicationStatuses.map((item) => (
              <BodyText key={item.status}>{item.status.replaceAll('_', ' ')} · {item.count}</BodyText>
            )) : <BodyText>No applications recorded yet. Saved opportunities are not counted as submitted.</BodyText>}
          </Panel>

          <Panel>
            <Heading>Seven principles</Heading>
            {data.principleActions.map((item) => (
              <BodyText key={item.principle}>
                Principle {item.principle} · {item.completed} completed of {item.planned} recorded
              </BodyText>
            ))}
          </Panel>

          <Panel>
            <Heading>Challenge</Heading>
            {data.challenge ? (
              <>
                <BodyText>Day {data.challenge.day} · Phase {data.challenge.phase} · {data.challenge.daysRemaining} days remaining</BodyText>
                <ProgressBar value={data.challenge.progressPercent} label={`${data.challenge.progressPercent}% elapsed`} />
              </>
            ) : <BodyText>Set a start date on Today when you are ready to begin.</BodyText>}
          </Panel>
        </>
      ) : null}
    </AppScreen>
  );
}
