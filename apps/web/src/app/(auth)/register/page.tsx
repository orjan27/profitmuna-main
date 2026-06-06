import Link from 'next/link';

import { BrandMark } from '@/components/BrandMark';
import { RegisterForm } from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <Link href="/" aria-label="Profitmuna home" className="mb-10">
        <BrandMark markClassName="h-6" />
      </Link>
      <RegisterForm />
    </main>
  );
}
