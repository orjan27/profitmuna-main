import { cookies } from 'next/headers';

import { resolveOverviewRange } from '@/lib/overview-date-presets';
import { PfContent } from './_components/pf-content';
import { PfFilters, type CategoryOption } from './_components/pf-filters';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SummaryAccount {
  id: number;
  name: string;
  /** Whole-number percent (e.g. 5 = 5%) — API returns bp/100 */
  targetPercentage: number;
  color: string;
  sortOrder: number;
  accountType: 'PROFIT' | 'OWNERS_PAY' | 'TAX' | 'OPEX' | 'CUSTOM';
  computedBalance: number;
}

interface SummaryResponse {
  data: {
    totalIncome: number;
    accounts: SummaryAccount[];
    categories: Array<{ id: number; name: string }>;
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

/**
 * RSC page for /profit-first.
 *
 * Reads URL searchParams directly (not via nuqs — Pitfall 5 guard: nuqs hooks
 * are called only in client components PfFilters and PfContent).
 *
 * SSR-fetches the summary DIRECT to the Workers API base URL using the
 * access_token Bearer header — not through the BFF proxy, which is reserved
 * for client-side fetches and Plan 04 server actions. Server-side code reads
 * the cookie directly and talks to the API base (auth.ts server pattern).
 *
 * Auth is enforced by middleware.ts which redirects unauthenticated users to
 * /login before this page renders (T-03-09).
 */
export default async function ProfitFirstPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; categoryIds?: string }>;
}) {
  const params = await searchParams;

  // Read access_token for server-side direct API fetch
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  // Resolve the time scope the same way as the overview/ledgers: empty URL is
  // the This Month default, ?from=all is All Time, any other pair is a custom
  // range (DateRangeSelect drives these params).
  const range = resolveOverviewRange(params.from, params.to);

  // Build query string from the resolved range + category filter
  const query = new URLSearchParams();
  if (range.from) query.set('from', range.from);
  if (range.to) query.set('to', range.to);
  if (params.categoryIds) query.set('categoryIds', params.categoryIds);
  const qs = query.toString();

  // Server-side: direct to API base (NOT through BFF proxy — server-to-server)
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8793';
  const summaryUrl = `${apiBaseUrl}/api/profit-first/summary${qs ? `?${qs}` : ''}`;

  let totalIncome = 0;
  let accounts: SummaryAccount[] = [];
  let categoryOptions: CategoryOption[] = [];

  try {
    const res = await fetch(summaryUrl, {
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      // no-store: balances must always reflect the latest income data (T-03-08)
      cache: 'no-store',
    });

    if (res.ok) {
      const json = (await res.json()) as SummaryResponse;
      totalIncome = json.data.totalIncome;
      accounts = json.data.accounts;
      // Map API categories to CategoryOption (id must be string — nuqs parseAsArrayOf(parseAsString))
      categoryOptions = json.data.categories.map((c) => ({ id: String(c.id), label: c.name }));
    }
  } catch {
    // Network error — page renders empty state; user can refresh
  }

  const jarCount = accounts.length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* Page header — title + jar metaphor tagline, with a live jar count pill */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profit First</h1>
          <p className="mt-1 text-sm text-ink-soft">Pour your income into jars</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-semibold text-ink-soft ring-1 ring-hairline">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-income" />
          {jarCount} {jarCount === 1 ? 'jar' : 'jars'}
        </span>
      </header>

      {/* Filter bar — client component (nuqs hooks — Pitfall 5) */}
      <PfFilters categoryOptions={categoryOptions} />

      {/*
       * PfContent: client component that owns amount-visibility state and
       * renders hero total → row of jars → funded-status banner.
       */}
      <PfContent accounts={accounts} totalIncome={totalIncome} />
    </div>
  );
}
