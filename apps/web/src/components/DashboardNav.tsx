'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/BrandMark';
import { useRecordSheet } from '@/components/RecordSheetProvider';

interface NavItem {
  readonly label: string;
  readonly href: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Overview', href: '/overview' },
  { label: 'Income', href: '/income' },
  { label: 'Expenses', href: '/expenses' },
  { label: 'Profit First', href: '/profit-first' },
  { label: 'Wallets', href: '/wallets' },
] as const;

/**
 * Shared top bar for all authenticated pages: brand lockup, five quiet text
 * links, and the global Record action. Active state is carried by ink color
 * and weight, not pills or icons — the chrome stays out of the money's way.
 *
 * Client Component: usePathname for active state, useRecordSheet for the
 * Record action. Sits on the deeper chrome gray (paper-deep) so the content
 * surface reads as the page.
 */
export function DashboardNav(): React.JSX.Element {
  const pathname = usePathname();
  const { openRecordSheet } = useRecordSheet();

  return (
    <header className="sticky top-0 z-10 border-b border-hairline bg-paper-deep/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 md:gap-7 md:px-8">
        <Link href="/overview" aria-label="Profitmuna overview" className="shrink-0">
          <BrandMark wordmarkClassName="max-sm:sr-only" />
        </Link>

        <nav className="min-w-0 flex-1" aria-label="Primary">
          <ul className="-mx-2 flex items-center gap-0.5 overflow-x-auto px-2">
            {NAV_ITEMS.map(({ label, href }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/');
              return (
                <li key={href} className="shrink-0">
                  <Link
                    href={href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'block rounded-md px-2.5 py-2 text-sm whitespace-nowrap transition-colors',
                      isActive
                        ? 'font-medium text-ink'
                        : 'text-ink-faint hover:text-ink-soft focus-visible:text-ink-soft'
                    )}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <Button size="sm" className="shrink-0" onClick={() => openRecordSheet('income')}>
          <Plus aria-hidden="true" />
          <span className="max-sm:sr-only">Record</span>
        </Button>
      </div>
    </header>
  );
}
