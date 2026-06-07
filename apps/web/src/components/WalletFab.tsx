import Link from 'next/link';
import { Wallet, Plus } from 'lucide-react';

/**
 * Mobile-only floating action button for the Wallets page. Navigates to
 * /wallets/new. Styled identically to RecordFab — same size-14 circle,
 * fixed placement above BottomNav, md:hidden. The Wallet icon is the primary
 * glyph with a small Plus badge overlaid in the top-right corner.
 *
 * Mounted by the Wallets page only — not in the dashboard layout — so it
 * never conflicts with RecordFab (which omits /wallets from RECORD_ROUTES).
 */
export function WalletFab(): React.JSX.Element {
  return (
    <Link
      href="/wallets/new"
      aria-label="New wallet"
      className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/25 transition-transform outline-none active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden"
    >
      {/* Primary glyph: Wallet icon */}
      <span className="relative">
        <Wallet className="size-7" strokeWidth={2.25} aria-hidden />
        {/* Small + badge overlaid top-right of the wallet icon */}
        <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-primary-foreground text-primary">
          <Plus className="size-2.5" strokeWidth={3} aria-hidden />
        </span>
      </span>
    </Link>
  );
}
