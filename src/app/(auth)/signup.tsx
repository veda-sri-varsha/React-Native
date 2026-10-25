import { AuthForm } from '@/components/auth-form';
import { useAuth } from '@/providers/auth-provider';

export default function SignUpScreen() {
  const { sessionNotice, signUp } = useAuth();
  return (
    <AuthForm
      mode="signup"
      notice={sessionNotice}
      onSubmit={(name, email, password) => signUp(name, email, password)}
    />
  );
}
