import { cookies } from 'next/headers';

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

  // Build query string from URL search params
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
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

  return (
    <div className="flex flex-col gap-8">
      {/* Page header */}
      <div>
        <h1 className="text-[20px] font-semibold leading-tight">Profit First</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure allocation percentages and track your income distribution.
        </p>
      </div>

      {/* Filter bar — client component (nuqs hooks — Pitfall 5) */}
      <PfFilters categoryOptions={categoryOptions} />

      {/*
       * PfContent: client component that owns amount-visibility state
       * and renders AmountToggle + PfOverview with server-fetched data.
       */}
      <PfContent accounts={accounts} totalIncome={totalIncome} />
    </div>
  );
}
