import { Link, router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLevelUpTheme } from '@/providers/levelup-theme-provider';

export function AppScreen({
  title,
  kicker,
  subtitle,
  children,
  action,
  refreshing,
  onRefresh,
  scroll = true,
  back = false,
}: {
  title: string;
  kicker?: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: { label: string; onPress: () => void };
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  back?: boolean;
}) {
  const { colors } = useLevelUpTheme();
  const content = (
    <>
      <View style={styles.topActions}>
        {back ? (
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.topAction}>
            <Text style={[styles.topActionText, { color: colors.secondary }]}>‹ Back</Text>
          </Pressable>
        ) : (
          <Text style={[styles.brand, { color: colors.accent }]}>LEVELUP 90</Text>
        )}
        <Link href="/settings" asChild>
          <Pressable accessibilityLabel="Open settings" style={styles.topAction}>
            <Text style={[styles.topActionText, { color: colors.secondary }]}>Settings</Text>
          </Pressable>
        </Link>
      </View>
      <View style={styles.heading}>
        {kicker ? <Text style={[styles.kicker, { color: colors.accent }]}>{kicker}</Text> : null}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.secondary }]}>{subtitle}</Text> : null}
      </View>
      {action ? <Button title={action.label} onPress={action.onPress} /> : null}
      {children}
    </>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={colors.accent}
              />
            ) : undefined
          }>
          {content}
        </ScrollView>
      ) : (
        <View style={styles.content}>{content}</View>
      )}
    </SafeAreaView>
  );
}

export function Panel({ children, style, ...props }: ViewProps) {
  const { colors } = useLevelUpTheme();
  return (
    <View
      {...props}
      style={[
        styles.panel,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}>
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { colors } = useLevelUpTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: secondary ? colors.raised : colors.accent },
        pressed && !disabled ? styles.pressed : null,
        (disabled || loading) && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.background} />
      ) : (
        <Text style={[styles.buttonText, { color: secondary ? colors.text : colors.background }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function AppTextInput({ style, ...props }: TextInputProps) {
  const { colors } = useLevelUpTheme();
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[
        styles.input,
        { backgroundColor: colors.raised, borderColor: colors.border, color: colors.text },
        style,
      ]}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  const { colors } = useLevelUpTheme();
  return <Text style={[styles.label, { color: colors.secondary }]}>{children}</Text>;
}

export function BodyText({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  const { colors } = useLevelUpTheme();
  return <Text style={[styles.body, { color: colors.secondary }, style]}>{children}</Text>;
}

export function Heading({ children }: { children: React.ReactNode }) {
  const { colors } = useLevelUpTheme();
  return <Text style={[styles.headingText, { color: colors.text }]}>{children}</Text>;
}

export function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  const { colors } = useLevelUpTheme();
  return (
    <Panel style={styles.statCard}>
      <Text style={[styles.statLabel, { color: colors.secondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: accent ? colors.accent : colors.text }]}>{value}</Text>
      {hint ? <Text style={[styles.statHint, { color: colors.muted }]}>{hint}</Text> : null}
    </Panel>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const { colors } = useLevelUpTheme();
  const progress = Math.min(100, Math.max(0, value));
  return (
    <View style={styles.progressWrap}>
      {label ? <Text style={[styles.progressLabel, { color: colors.secondary }]}>{label}</Text> : null}
      <View style={[styles.progressTrack, { backgroundColor: colors.raised }]}>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: progress }}
          style={[styles.progressFill, { backgroundColor: colors.accent, width: `${progress}%` }]}
        />
      </View>
    </View>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
}) {
  const { colors } = useLevelUpTheme();
  return (
    <Panel style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyText, { color: colors.secondary }]}>{message}</Text>
      {action ? <Button title={action.label} onPress={action.onPress} secondary /> : null}
    </Panel>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useLevelUpTheme();
  return (
    <Panel style={[styles.errorPanel, { borderColor: colors.red }]}>
      <Text style={[styles.errorTitle, { color: colors.red }]}>Could not load saved data</Text>
      <Text style={[styles.body, { color: colors.secondary }]}>{message}</Text>
      {onRetry ? <Button title="Try again" secondary onPress={onRetry} /> : null}
    </Panel>
  );
}

export function LoadingBlock({ message = 'Loading saved records…' }: { message?: string }) {
  const { colors } = useLevelUpTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={[styles.body, { color: colors.secondary }]}>{message}</Text>
    </View>
  );
}

export function Row({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  const { colors } = useLevelUpTheme();
  const content = (
    <Panel style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{label}</Text>
        {value ? <Text style={[styles.body, { color: colors.secondary }]}>{value}</Text> : null}
      </View>
      <Text style={[styles.chevron, { color: colors.accent }]}>›</Text>
    </Panel>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  );
}

export const screenContentProps: Partial<ScrollViewProps> = {
  showsVerticalScrollIndicator: false,
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { alignSelf: 'center', gap: 16, maxWidth: 760, padding: 20, paddingBottom: 36, width: '100%' },
  topActions: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  topAction: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 4 },
  topActionText: { fontSize: 13, fontWeight: '700' },
  brand: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  heading: { gap: 5, marginBottom: 5, marginTop: 4 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { fontSize: 14, lineHeight: 21 },
  panel: { borderRadius: 18, borderWidth: 1, gap: 10, padding: 16 },
  button: { alignItems: 'center', borderRadius: 13, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16 },
  buttonText: { fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
  input: { borderRadius: 12, borderWidth: 1, fontSize: 15, minHeight: 48, paddingHorizontal: 13, paddingVertical: 11 },
  label: { fontSize: 12, fontWeight: '700' },
  body: { fontSize: 13, lineHeight: 20 },
  headingText: { fontSize: 17, fontWeight: '800' },
  statCard: { flex: 1, gap: 6, minWidth: 116 },
  statLabel: { fontSize: 12, fontWeight: '700' },
  statValue: { fontSize: 27, fontWeight: '800' },
  statHint: { fontSize: 11, lineHeight: 16 },
  progressWrap: { gap: 7 },
  progressLabel: { fontSize: 12, fontWeight: '700' },
  progressTrack: { borderRadius: 99, height: 9, overflow: 'hidden' },
  progressFill: { borderRadius: 99, height: '100%' },
  empty: { alignItems: 'center', gap: 9, paddingVertical: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  errorPanel: { gap: 8 },
  errorTitle: { fontSize: 14, fontWeight: '800' },
  loading: { alignItems: 'center', flex: 1, gap: 14, justifyContent: 'center', padding: 30 },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  chevron: { fontSize: 26, marginLeft: 8 },
});
