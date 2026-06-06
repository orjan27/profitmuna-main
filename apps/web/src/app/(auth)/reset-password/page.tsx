import Link from 'next/link';

import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <h1 className="mb-2 text-xl font-semibold">Invalid reset link</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            This reset link is missing a token. Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <ResetPasswordForm token={token} />
    </main>
  );
}
