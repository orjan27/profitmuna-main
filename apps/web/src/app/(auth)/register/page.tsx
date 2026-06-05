import { RegisterForm } from '@/components/auth/RegisterForm';

// No UI-SPEC contract exists for this phase (user chose --skip-ui),
// so styling uses shadcn + STANDARDS defaults.
export default function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <RegisterForm />
    </main>
  );
}
