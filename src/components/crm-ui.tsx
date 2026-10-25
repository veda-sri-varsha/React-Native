import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export const CRM = {
  background: '#f5f7fb',
  surface: '#ffffff',
  text: '#172033',
  secondary: '#697386',
  border: '#e3e8f0',
  primary: '#2458e6',
  paleBlue: '#eaf0ff',
  green: '#138a5b',
  paleGreen: '#e6f6ef',
  red: '#b42318',
  paleRed: '#fff0ee',
};

export function ActionButton({
  title,
  onPress,
  loading = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        pressed && !loading && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={secondary ? CRM.primary : '#ffffff'} />
      ) : (
        <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={CRM.primary} size="large" />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

export function MessageCard({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={styles.messageCard}>
      <Text style={styles.messageTitle}>{title}</Text>
      <Text style={styles.messageText}>{message}</Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: CRM.surface,
    borderColor: CRM.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
});

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: CRM.primary,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { backgroundColor: CRM.paleBlue },
  secondaryButtonText: { color: CRM.primary },
  pressed: { opacity: 0.8 },
  loading: { alignItems: 'center', gap: 12, justifyContent: 'center', padding: 28 },
  loadingText: { color: CRM.secondary, fontSize: 14 },
  messageCard: {
    backgroundColor: CRM.paleRed,
    borderRadius: 14,
    gap: 6,
    padding: 16,
  },
  messageTitle: { color: CRM.red, fontSize: 15, fontWeight: '700' },
  messageText: { color: CRM.text, fontSize: 14, lineHeight: 20 },
  retry: { alignSelf: 'flex-start', marginTop: 6, paddingVertical: 4 },
  retryText: { color: CRM.primary, fontSize: 14, fontWeight: '700' },
});
