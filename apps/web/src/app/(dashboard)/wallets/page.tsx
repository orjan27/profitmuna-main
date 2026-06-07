import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth';
import { apiFetch } from '@/server/api';
import { formatCurrency } from '@/lib/format-currency';
import type { CurrencyCode } from '@/lib/format-currency';
import type { UserSettings } from '@/types/settings';
import { Button } from '@/components/ui/button';
import { StellaSprite } from '@/components/Stella';
import { WalletFab } from '@/components/WalletFab';
import type { WalletListItem, PfAccount } from '@/types/wallet';
import { WalletRow } from './_components/WalletRow';

type WalletListResponse = {
  data: WalletListItem[];
};

type PfSummaryResponse = {
  data: {
    accounts: PfAccount[];
  };
};

export default async function WalletsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Fetch display currency setting (falls back to PHP if unavailable — Server Component)
  let displayCurrency: CurrencyCode = 'PHP';
  try {
    const { data: settings } = await apiFetch<{ data: UserSettings }>('/api/settings');
    displayCurrency = settings.displayCurrency;
  } catch {
    // Fall back to PHP default
  }

  // Fetch wallet list and PF accounts in parallel
  const [walletsRes, pfSummaryRes] = await Promise.all([
    apiFetch<WalletListResponse>('/api/wallets').catch(() => ({ data: [] as WalletListItem[] })),
    apiFetch<PfSummaryResponse>('/api/profit-first/summary').catch(() => ({
      data: { accounts: [] as PfAccount[] },
    })),
  ]);

  const wallets = walletsRes.data ?? [];
  const pfAccounts = pfSummaryRes.data?.accounts ?? [];
  const totalBalanceCents = wallets.reduce((sum, w) => sum + w.balanceCents, 0);

  // Determine which PF accounts are unlinked (no wallet yet) for the empty-state quick-create
  const linkedPfAccountIds = new Set(
    wallets
      .filter((w) => w.profitFirstAccountId != null)
      .map((w) => w.profitFirstAccountId as number)
  );
  const unlinkedPfAccounts = pfAccounts.filter((a) => !linkedPfAccountIds.has(a.id));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] leading-tight font-semibold">Wallets</h1>
          {wallets.length > 0 ? (
            <>
              {/* Same display scale as the Overview hero — money reads at one
                  size across pages */}
              <p className="mt-3 text-[34px] leading-none font-semibold tracking-tight tabular-nums">
                {formatCurrency(totalBalanceCents, displayCurrency)}
              </p>
              <p className="mt-1.5 text-sm text-ink-faint">
                across {wallets.length} wallet{wallets.length !== 1 ? 's' : ''}
              </p>
            </>
          ) : null}
        </div>
        {/* One primary per view: the empty state's Create wallet CTA owns the
            action when there are no wallets yet. Hidden on mobile where
            WalletFab (rendered below) provides the thumb-zone affordance. */}
        {wallets.length > 0 ? (
          <Button size="sm" asChild className="max-md:hidden">
            <Link href="/wallets/new">New wallet</Link>
          </Button>
        ) : null}
      </div>

      {wallets.length > 0 ? (
        /* Ledger rows — sorted by sortOrder (server already returns them in order) */
        <ul className="divide-y divide-hairline/60">
          {wallets.map((wallet) => (
            <WalletRow key={wallet.id} wallet={wallet} />
          ))}
        </ul>
      ) : (
        /* Empty state (D-04) */
        <div className="py-20 text-center">
          <StellaSprite mood="sleeping" size={64} className="mx-auto" />
          <p className="mt-5 text-base font-medium">No wallets yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-faint">
            Track where your money actually sits by creating a wallet for each allocation account.
          </p>

          {unlinkedPfAccounts.length > 0 && (
            <div className="mt-8">
              <p className="text-xs font-medium tracking-[0.12em] text-ink-faint uppercase">
                Quick-create from your buckets
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {unlinkedPfAccounts.map((account) => (
                  <Button key={account.id} variant="outline" size="sm" asChild>
                    <Link href={`/wallets/new?pfAccountId=${account.id}`}>+ {account.name}</Link>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Button className="mt-8" asChild>
            <Link href="/wallets/new">Create wallet</Link>
          </Button>
        </div>
      )}

      {/* Mobile FAB — mirrors RecordFab placement/size; self-hidden at md+ via md:hidden */}
      {wallets.length > 0 ? <WalletFab /> : null}
    </div>
  );
}
