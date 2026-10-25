import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen, AppTextInput, BodyText, Button, ErrorState, Heading, Panel } from '@/components/levelup-ui';
import { RecordForm } from '@/components/record-form';
import { useGrowthCollection } from '@/hooks/use-growth-collection';
import { type GrowthRecord } from '@/lib/growth';
import { useAuth } from '@/providers/auth-provider';
import { useLevelUpTheme } from '@/providers/levelup-theme-provider';

export default function SettingsScreen() {
  const { request, signOut } = useAuth();
  const { colors, mode, setMode } = useLevelUpTheme();
  const settings = useGrowthCollection('settings');
  const [formVisible, setFormVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [exportText, setExportText] = useState('');
  const [exporting, setExporting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const savedSettings = settings.records[0] ?? null;

  const saveSettings = async (value: Record<string, unknown>) => {
    const record = savedSettings
      ? await settings.update(savedSettings.id, value)
      : await settings.create(value);
    const nextTheme = record.theme;
    if (nextTheme === 'dark' || nextTheme === 'light') {
      try {
        await setMode(nextTheme);
      } catch {
        setNotice('Your account settings were saved, but the theme preference could not be stored on this device.');
      }
    }
  };

  const exportData = async () => {
    setExporting(true);
    setError('');
    try {
      const data = await request<{ exportedAt: string; data: Record<string, GrowthRecord[]> }>('/api/growth/export');
      setExportText(JSON.stringify(data, null, 2));
      setExportVisible(true);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Could not export your records.');
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setError('');
    try {
      await request<void>('/api/account', { method: 'DELETE' });
      await signOut();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete your account.');
      setDeleting(false);
    }
  };

  return (
    <>
      <AppScreen
        back
        title="Settings and privacy"
        kicker="YOUR ACCOUNT"
        subtitle="Control your schedule, appearance, and private records."
        refreshing={settings.refreshing}
        onRefresh={() => void settings.refresh()}>
        {settings.error ? <ErrorState message={settings.error} onRetry={() => void settings.refresh()} /> : null}
        {error ? <ErrorState message={error} /> : null}
        {notice ? <BodyText>{notice}</BodyText> : null}

        <Panel>
          <Heading>Planning preferences</Heading>
          {savedSettings ? (
            <>
              <BodyText>Weekly review: {String(savedSettings.weeklyReviewDay)}</BodyText>
              <BodyText>Available study time: {String(savedSettings.dailyStudyMinutes)} minutes / day</BodyText>
              <BodyText>Cybersecurity target: {String(savedSettings.cybersecurityTargetMinutes)} minutes / day</BodyText>
              <BodyText>Exercise target: {String(savedSettings.exerciseTargetDays)} days / week</BodyText>
            </>
          ) : (
            <BodyText>No planning preferences saved. You can set realistic targets when you are ready.</BodyText>
          )}
          <Button
            title={savedSettings ? 'Edit preferences' : 'Set preferences'}
            secondary
            onPress={() => setFormVisible(true)}
          />
        </Panel>

        <Panel>
          <Heading>Appearance</Heading>
          <BodyText>Current theme: {mode}</BodyText>
          <View style={styles.actions}>
            <Button title="Dark" secondary onPress={() => void setMode('dark').catch(() => setError('Could not save the theme on this device.'))} />
            <Button title="Light" secondary onPress={() => void setMode('light').catch(() => setError('Could not save the theme on this device.'))} />
          </View>
          <BodyText>Theme selection is stored locally on this device.</BodyText>
        </Panel>

        <Panel>
          <Heading>Export my data</Heading>
          <BodyText>Fetch a JSON export of your saved trackers. Review or copy it from the preview before leaving this screen.</BodyText>
          <Button title="Prepare export" loading={exporting} onPress={() => void exportData()} />
        </Panel>

        <Panel style={{ borderColor: colors.red }}>
          <Heading>Delete account</Heading>
          <BodyText>This permanently removes your LevelUp account and saved growth records. Existing lead inbox records are workspace data and are not deleted here. This cannot be undone.</BodyText>
          <BodyText>Type DELETE to confirm.</BodyText>
          <AppTextInput
            accessibilityLabel="Type DELETE to confirm account deletion"
            autoCapitalize="characters"
            onChangeText={setDeleteConfirmation}
            placeholder="DELETE"
            value={deleteConfirmation}
          />
          <Button
            title="Permanently delete account"
            disabled={deleteConfirmation !== 'DELETE'}
            loading={deleting}
            onPress={() => void deleteAccount()}
          />
        </Panel>
        <Button title="Log out" secondary onPress={() => void signOut()} />
      </AppScreen>

      <RecordForm
        collection="settings"
        visible={formVisible}
        record={savedSettings}
        onClose={() => setFormVisible(false)}
        onSave={saveSettings}
        title={savedSettings ? 'Update planning preferences' : 'Set planning preferences'}
      />

      <Modal animationType="slide" onRequestClose={() => setExportVisible(false)} visible={exportVisible}>
        <View style={[styles.exportModal, { backgroundColor: colors.background }]}>
          <View style={styles.exportHeader}>
            <View style={{ flex: 1, gap: 4 }}>
              <Heading>Your data export</Heading>
              <BodyText>JSON from your authenticated account. Select and copy as needed.</BodyText>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setExportVisible(false)} style={styles.close}>
              <Text style={{ color: colors.accent, fontWeight: '800' }}>Close</Text>
            </Pressable>
          </View>
          <ScrollView style={[styles.exportBody, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text selectable style={{ color: colors.text, fontFamily: 'monospace', fontSize: 11, lineHeight: 17 }}>
              {exportText}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  exportModal: { flex: 1, paddingTop: 42 },
  exportHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between', padding: 20 },
  close: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  exportBody: { borderRadius: 12, borderWidth: 1, flex: 1, margin: 16, padding: 12 },
});
