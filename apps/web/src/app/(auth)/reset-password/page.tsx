import Link from 'next/link';

import { AuthShell } from '@/components/AuthShell';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthShell>
        <div className="w-full">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Invalid reset link</h1>
          <p className="mt-2 text-base text-ink-soft">
            This reset link is missing a token. Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-block text-sm font-medium text-[oklch(0.6_0.17_28)] underline-offset-4 transition-colors hover:text-[oklch(0.52_0.17_28)] hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
