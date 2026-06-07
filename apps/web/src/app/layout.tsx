import type { Metadata } from 'next';
import { Hanken_Grotesk } from 'next/font/google';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

const hanken = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-hanken' });

export const metadata: Metadata = {
  title: 'Profitmuna',
  description:
    'Profit First budgeting, applied automatically. Record income and it splits across your buckets the moment it lands.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={hanken.variable}>
      <body className="font-sans antialiased">
        <TooltipProvider>
          <NuqsAdapter>{children}</NuqsAdapter>
          <Toaster richColors theme="dark" />
        </TooltipProvider>
      </body>
    </html>
  );
}
