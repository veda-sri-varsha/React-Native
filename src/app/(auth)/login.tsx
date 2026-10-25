import { AuthForm } from '@/components/auth-form';
import { useAuth } from '@/providers/auth-provider';

export default function LoginScreen() {
  const { sessionNotice, signIn } = useAuth();
  return (
    <AuthForm
      mode="login"
      notice={sessionNotice}
      onSubmit={(_name, email, password) => signIn(email, password)}
    />
  );
}
