import { Link } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, CRM } from '@/components/crm-ui';

type AuthFormProps = {
  mode: 'login' | 'signup';
  notice?: string | null;
  onSubmit: (name: string, email: string, password: string) => Promise<void>;
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType,
  secureTextEntry = false,
  autoCapitalize = 'none',
  textContentType,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  error?: string;
  keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'words';
  textContentType?: 'name' | 'emailAddress' | 'password' | 'newPassword';
  autoComplete?: 'name' | 'email' | 'password' | 'new-password' | 'off';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#929bad"
        returnKeyType="next"
        secureTextEntry={secureTextEntry}
        style={[styles.input, error ? styles.inputError : null]}
        textContentType={textContentType}
        value={value}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function AuthForm({ mode, notice, onSubmit }: AuthFormProps) {
  const isSignup = mode === 'signup';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const errors: Record<string, string> = {};
    if (isSignup && name.trim().length < 2) errors.name = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    if (password.length < 8) errors.password = 'Use at least 8 characters.';
    if (isSignup && confirmPassword !== password) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    setFieldErrors(errors);
    setSubmitError('');
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      await onSubmit(name.trim(), email.trim(), password);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            <View style={styles.brandMark}>
              <Text style={styles.brandLetter}>L</Text>
            </View>
            <Text style={styles.eyebrow}>LEVELUP 90</Text>
            <Text style={styles.title}>{isSignup ? 'Create your account' : 'Welcome back'}</Text>
            <Text style={styles.subtitle}>
              {isSignup
                ? 'Build sustainable momentum across learning, projects, and career goals.'
                : 'Sign in to continue with your private growth dashboard.'}
            </Text>

            {notice ? (
              <View accessibilityRole="alert" style={styles.noticeBox}>
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}

            {isSignup ? (
              <>
                <Field
                  autoCapitalize="words"
                  autoComplete="name"
                  error={fieldErrors.name}
                  label="Full name"
                  onChangeText={setName}
                  placeholder="Your name"
                  textContentType="name"
                  value={name}
                />
              </>
            ) : null}
            <Field
              autoComplete="email"
              error={fieldErrors.email}
              keyboardType="email-address"
              label="Email address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              textContentType="emailAddress"
              value={email}
            />
            <Field
              autoComplete={isSignup ? 'new-password' : 'password'}
              error={fieldErrors.password}
              label="Password"
              onChangeText={setPassword}
              placeholder={isSignup ? 'At least 8 characters' : 'Enter your password'}
              secureTextEntry
              textContentType={isSignup ? 'newPassword' : 'password'}
              value={password}
            />
            {isSignup ? (
              <Field
                autoComplete="new-password"
                error={fieldErrors.confirmPassword}
                label="Confirm password"
                onChangeText={setConfirmPassword}
                placeholder="Enter your password again"
                secureTextEntry
                textContentType="newPassword"
                value={confirmPassword}
              />
            ) : null}

            {submitError ? (
              <View accessibilityRole="alert" style={styles.errorBox}>
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            ) : null}
            <ActionButton
              loading={submitting}
              onPress={() => void submit()}
              title={isSignup ? 'Create account' : 'Sign in'}
            />
            <View style={styles.linkRow}>
              <Text style={styles.linkPrompt}>
                {isSignup ? 'Already have an account? ' : 'New to LevelUp 90? '}
              </Text>
              <Link href={isSignup ? '../login' : '../signup'} style={styles.link}>
                {isSignup ? 'Sign in' : 'Create an account'}
              </Link>
            </View>
            <Text style={styles.footer}>Your password is protected on the server. Your account data stays private to you.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: CRM.background, flex: 1 },
  keyboard: { flex: 1 },
  scrollContent: { alignItems: 'center', flexGrow: 1, justifyContent: 'center', padding: 22 },
  container: {
    backgroundColor: CRM.surface,
    borderColor: CRM.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    maxWidth: 460,
    padding: 26,
    width: '100%',
  },
  brandMark: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: CRM.primary,
    borderRadius: 17,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  brandLetter: { color: '#ffffff', fontSize: 26, fontWeight: '800' },
  eyebrow: { color: CRM.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textAlign: 'center' },
  title: { color: CRM.text, fontSize: 27, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { color: CRM.secondary, fontSize: 14, lineHeight: 21, marginBottom: 2, textAlign: 'center' },
  field: { gap: 7 },
  label: { color: CRM.text, fontSize: 13, fontWeight: '700' },
  input: {
    backgroundColor: '#fbfcfe',
    borderColor: CRM.border,
    borderRadius: 12,
    borderWidth: 1,
    color: CRM.text,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  inputError: { borderColor: CRM.red },
  fieldError: { color: CRM.red, fontSize: 12 },
  errorBox: { backgroundColor: CRM.paleRed, borderRadius: 10, padding: 12 },
  errorText: { color: CRM.red, fontSize: 13, lineHeight: 19 },
  noticeBox: { backgroundColor: '#fff6df', borderRadius: 10, padding: 12 },
  noticeText: { color: '#785300', fontSize: 13, lineHeight: 19 },
  linkRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  linkPrompt: { color: CRM.secondary, fontSize: 13 },
  link: { color: CRM.primary, fontSize: 13, fontWeight: '700' },
  footer: { color: '#8791a2', fontSize: 11, textAlign: 'center' },
});
