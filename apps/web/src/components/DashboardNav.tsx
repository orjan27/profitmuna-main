'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle } from '@/components/ThemeToggle';

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
  { label: 'Settings', href: '/settings' },
] as const;

/**
 * Shared top bar for all authenticated pages. At md+ it carries the brand
 * lockup and five quiet text links; on mobile the links hide and this becomes
 * a slim brand bar — navigation moves to BottomNav. Active state is carried
 * by ink color and weight, not pills or icons — the chrome stays out of the
 * money's way.
 *
 * Record actions live in page content (one labeled primary per page; the
 * mobile RecordFab on record pages), not in the chrome — one primary action
 * per view.
 *
 * Client Component: usePathname for active state. Sits on the deeper chrome
 * gray (paper-deep) so the content surface reads as the page.
 */
export function DashboardNav(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-hairline bg-paper-deep/90 backdrop-blur">
      {/* Three-zone grid: brand | centered links | theme toggle.
          Equal 1fr side columns keep the menu truly centered in the bar. */}
      <div className="mx-auto grid h-14 w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4 md:px-8">
        <Link
          href="/overview"
          aria-label="Profitmuna overview"
          className="shrink-0 justify-self-start"
        >
          <BrandMark markClassName="h-8" />
        </Link>

        {/* md+: BottomNav owns primary navigation on mobile. */}
        <nav className="min-w-0 max-md:hidden" aria-label="Primary">
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

        <div className="col-start-3 justify-self-end">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
