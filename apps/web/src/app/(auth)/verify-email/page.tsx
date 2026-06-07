import Link from 'next/link';

import { BrandMark } from '@/components/BrandMark';
import { VerifyEmailStatus } from './VerifyEmailStatus';

interface VerifyEmailPageProps {
  // searchParams is async in Next.js 15
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <Link href="/" aria-label="Profitmuna home" className="mb-10">
        <BrandMark markClassName="h-12" />
      </Link>
      <VerifyEmailStatus token={token} />
    </main>
  );
}
