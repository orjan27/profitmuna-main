'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Banknote, House, Percent, Receipt, Wallet } from 'lucide-react';

import { cn } from '@/lib/utils';

interface BottomNavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const NAV_ITEMS: readonly BottomNavItem[] = [
  { label: 'Overview', href: '/overview', icon: House },
  { label: 'Income', href: '/income', icon: Banknote },
  { label: 'Expenses', href: '/expenses', icon: Receipt },
  { label: 'Profit Muna', href: '/profit-muna', icon: Percent },
  { label: 'Wallets', href: '/wallets', icon: Wallet },
] as const;

/**
 * Mobile-only bottom tab bar (hidden at md+ where DashboardNav's top links
 * take over). Five equal tabs, each a full-height touch target; active state
 * is ink color and weight — same quiet vocabulary as the top bar. Sits on
 * paper-deep chrome with a hairline divider and respects the home-indicator
 * safe area.
 */
export function BottomNav(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-hairline bg-paper-deep/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-1 transition-colors',
                  isActive ? 'text-ink' : 'text-ink-faint hover:text-ink-soft'
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span
                  className={cn(
                    'text-[11px] leading-none whitespace-nowrap',
                    isActive && 'font-medium'
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
