import { VerifyEmailStatus } from './VerifyEmailStatus';

interface VerifyEmailPageProps {
  // searchParams is async in Next.js 15
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <VerifyEmailStatus token={token} />
    </main>
  );
}
