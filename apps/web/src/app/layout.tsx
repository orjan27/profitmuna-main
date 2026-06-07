import type { Metadata, Viewport } from 'next';
import { Hanken_Grotesk } from 'next/font/google';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ThemeToaster } from '@/components/ThemeToaster';
import './globals.css';

const hanken = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-hanken' });

// viewport-fit=cover lets env(safe-area-inset-bottom) resolve on notched
// phones so BottomNav and form action bars clear the home indicator.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Profitmuna',
  description:
    'Profit First budgeting, applied automatically. Record income and it splits across your buckets the moment it lands.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={hanken.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TooltipProvider>
            <NuqsAdapter>{children}</NuqsAdapter>
            <ThemeToaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
