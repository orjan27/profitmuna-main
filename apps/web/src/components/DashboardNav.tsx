'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, TrendingUp, TrendingDown, PieChart, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Income', href: '/income', icon: TrendingUp },
  { label: 'Expenses', href: '/expenses', icon: TrendingDown },
  { label: 'Profit First', href: '/profit-first', icon: PieChart },
  { label: 'Wallets', href: '/wallets', icon: Wallet },
] as const;

/**
 * Shared navigation bar for all authenticated pages.
 *
 * Renders a horizontal nav with five links: Dashboard, Income, Expenses,
 * Profit First, and Wallets. The link matching the current pathname is
 * highlighted as active.
 *
 * Must be a Client Component because it uses `usePathname` for active-state
 * detection. The parent (dashboard) layout stays a Server Component and
 * renders this component at the top of every authenticated page.
 */
export function DashboardNav(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <ul className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive =
              href === '/'
                ? pathname === '/'
                : pathname === href || pathname.startsWith(href + '/');

            return (
              <li key={href} className="flex-shrink-0">
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
