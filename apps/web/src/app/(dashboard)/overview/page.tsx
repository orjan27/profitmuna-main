import { redirect } from 'next/navigation';
import { TZDate } from '@date-fns/tz';

import { getSession } from '@/server/auth';
import { apiFetch } from '@/server/api';
import type { DashboardSummary } from '@/types/dashboard';
import { OverviewContent } from './_components/overview-content';
import { ALL_TIME_SENTINEL, getDefaultOverviewRange } from './_components/overview-filters';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Time-of-day greeting anchored to Asia/Manila — the app's currency is PHP,
 * so the user's clock is assumed local to it. Phase 6 currency swap point:
 * derive the zone alongside the locale when other currencies land.
 */
function greetingForNow(): string {
  const hour = new TZDate(Date.now(), 'Asia/Manila').getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// ── Page ──────────────────────────────────────────────────────────────────────

/**
 * The signed-in home: period-scoped wallet balance, income/expense/net
 * figures, the allocation split with per-account balances, and a unified
 * recent-transactions feed — all from one summary endpoint (DASH-01).
 *
 * The date filter lives in the URL (?from/?to, nuqs in the client component —
 * Pitfall 2: no nuqs here). Empty URL applies the This Month Manila default
 * (D-08); ?from=all marks an explicit All Time choice.
 */
export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const hasUrlFilter = Boolean(params.from || params.to);
  const allTime = params.from === ALL_TIME_SENTINEL;
  const defaults = getDefaultOverviewRange();
  const from = allTime ? undefined : (params.from ?? defaults.from);
  const to = allTime ? undefined : (params.to ?? defaults.to);

  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (to) query.set('to', to);

  // One aggregate call replaces the old four-endpoint fan-out. On failure the
  // content renders zeroed figures rather than blanking the page (D-12).
  const summary = await apiFetch<{ data: DashboardSummary }>(
    `/api/dashboard/summary?${query.toString()}`
  )
    .then((res) => res.data)
    .catch(() => null);

  return (
    <OverviewContent
      // Re-key per period so the client feed state resets on filter change
      key={`${from ?? 'all'}-${to ?? 'all'}`}
      greeting={greetingForNow()}
      summary={summary}
      from={from}
      to={to}
      hasUrlFilter={hasUrlFilter}
    />
  );
}
