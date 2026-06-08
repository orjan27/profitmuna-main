import { AuthShell } from '@/components/AuthShell';

import { VerifyEmailStatus } from './VerifyEmailStatus';

interface VerifyEmailPageProps {
  // searchParams is async in Next.js 15
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  return (
    <AuthShell>
      <VerifyEmailStatus token={token} />
    </AuthShell>
  );
}
