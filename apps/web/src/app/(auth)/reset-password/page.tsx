import Link from 'next/link';

import { BrandMark } from '@/components/BrandMark';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
        <Link href="/" aria-label="Profitmuna home" className="mb-10">
          <BrandMark markClassName="h-12" />
        </Link>
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold tracking-tight">Invalid reset link</h1>
          <p className="mt-1 text-sm text-ink-soft">
            This reset link is missing a token. Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-block text-sm text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <Link href="/" aria-label="Profitmuna home" className="mb-10">
        <BrandMark markClassName="h-12" />
      </Link>
      <ResetPasswordForm token={token} />
    </main>
  );
}
