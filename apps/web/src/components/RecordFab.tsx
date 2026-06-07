'use client';

import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';

import { useRecordSheet } from '@/components/RecordSheetProvider';
import type { RecordMode } from '@/components/RecordSheet';

interface RecordRoute {
  readonly prefix: string;
  readonly mode: RecordMode;
}

/** Pages whose primary action is recording; order matters (first match wins). */
const RECORD_ROUTES: readonly RecordRoute[] = [
  { prefix: '/expenses', mode: 'expense' },
  { prefix: '/income', mode: 'income' },
  { prefix: '/overview', mode: 'income' },
] as const;

/**
 * Mobile-only floating Record button. Renders on record pages (Overview,
 * Income, Expenses) as a large circular + in the thumb zone, just above
 * BottomNav, and opens the global Record sheet in the page's mode. Hidden on
 * the /new full-page forms (recording is already the page) and at md+ where
 * the inline labeled Record buttons take over.
 */
export function RecordFab(): React.JSX.Element | null {
  const pathname = usePathname();
  const { openRecordSheet } = useRecordSheet();

  const route = RECORD_ROUTES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(prefix + '/')
  );
  if (!route || pathname.endsWith('/new')) return null;

  const label = route.mode === 'expense' ? 'Record expense' : 'Record income';

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => openRecordSheet(route.mode)}
      className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/25 transition-transform outline-none active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden"
    >
      <Plus className="size-7" strokeWidth={2.25} aria-hidden />
    </button>
  );
}
