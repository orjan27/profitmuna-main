import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth';
import { apiFetch } from '@/server/api';
import { Button } from '@/components/ui/button';
import type { WalletListItem, PfAccount } from '@/types/wallet';
import { WalletCard } from './_components/WalletCard';

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

  // Fetch wallet list and PF accounts in parallel
  const [walletsRes, pfSummaryRes] = await Promise.all([
    apiFetch<WalletListResponse>('/api/wallets').catch(() => ({ data: [] as WalletListItem[] })),
    apiFetch<PfSummaryResponse>('/api/profit-first/summary').catch(() => ({
      data: { accounts: [] as PfAccount[] },
    })),
  ]);

  const wallets = walletsRes.data ?? [];
  const pfAccounts = pfSummaryRes.data?.accounts ?? [];

  // Determine which PF accounts are unlinked (no wallet yet) for the empty-state quick-create
  const linkedPfAccountIds = new Set(
    wallets
      .filter((w) => w.profitFirstAccountId != null)
      .map((w) => w.profitFirstAccountId as number)
  );
  const unlinkedPfAccounts = pfAccounts.filter((a) => !linkedPfAccountIds.has(a.id));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Wallets</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your Profit First wallets and track money across accounts.
          </p>
        </div>
        <Button asChild>
          <Link href="/wallets/new">Create Wallet</Link>
        </Button>
      </div>

      {wallets.length > 0 ? (
        /* Card grid — sorted by sortOrder (server already returns them in order) */
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {wallets.map((wallet) => (
            <WalletCard key={wallet.id} wallet={wallet} />
          ))}
        </div>
      ) : (
        /* Empty state (D-04) */
        <div className="flex flex-col items-center rounded-xl border px-6 py-12 text-center">
          <h2 className="text-base font-semibold">No wallets yet</h2>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm">
            Track your Profit First allocations by creating a wallet for each account.
          </p>

          {unlinkedPfAccounts.length > 0 && (
            <div className="mt-6">
              <p className="text-muted-foreground mb-3 text-xs">
                Quick-create for your allocation accounts:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {unlinkedPfAccounts.map((account) => (
                  <Button key={account.id} variant="outline" size="sm" asChild>
                    <Link href={`/wallets/new?pfAccountId=${account.id}`}>+ {account.name}</Link>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Button className="mt-6" asChild>
            <Link href="/wallets/new">Create Wallet</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
