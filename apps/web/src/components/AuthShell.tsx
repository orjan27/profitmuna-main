import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

import { BrandMark } from '@/components/BrandMark';

interface AuthShellProps {
  children: React.ReactNode;
}

/**
 * Split-screen shell for the public auth surface (login, register, password
 * reset, email verification). The left column holds the brand mark and the
 * form slot; the right column is a warm brand panel with a sample balance
 * preview, shown on large screens only.
 *
 * This surface deliberately runs in the LIGHT theme via the `light` class —
 * the marketing-grade auth entry is the documented exception to the in-app
 * warm dark-gray posture (see docs/DESIGN.md). Establishing `light` here also
 * flips every shadcn form control inside to dark-on-light automatically.
 */
export function AuthShell({ children }: AuthShellProps): React.JSX.Element {
  return (
    <div className="light min-h-screen bg-[oklch(0.985_0.004_95)] text-ink lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
      <div className="flex min-h-screen flex-col px-6 py-10 sm:px-12 lg:py-12 lg:pl-16 lg:pr-12">
        <Link href="/" aria-label="Profitmuna home" className="inline-flex w-fit">
          <BrandMark markClassName="h-10" />
        </Link>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm py-10">{children}</div>
        </div>
      </div>

      <BrandPanel />
    </div>
  );
}

function BrandPanel(): React.JSX.Element {
  return (
    <div className="relative hidden overflow-hidden lg:block">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, oklch(0.895 0.055 26) 0%, oklch(0.95 0.024 58) 38%, oklch(0.95 0.018 122) 64%, oklch(0.9 0.05 158) 100%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 85% at 14% 10%, oklch(0.98 0.03 48 / 0.55), transparent 58%)',
        }}
      />
      <div className="relative flex h-full items-center justify-center p-12">
        <BalancePreviewCard />
      </div>
    </div>
  );
}

// Illustrative figures only — the visitor is unauthenticated, so this panel
// never shows real account data. It previews what the product delivers.
function BalancePreviewCard(): React.JSX.Element {
  const line =
    'M8 64 L28 58 L48 66 L68 52 L88 57 L108 46 L128 51 L148 40 L168 46 L188 34 L208 40 L228 28 L248 33 L268 22 L288 27 L312 14';
  const area = `${line} L312 88 L8 88 Z`;

  return (
    <div className="w-full max-w-sm rounded-2xl bg-[oklch(0.995_0.002_90)] p-6 shadow-[0_28px_70px_-24px_oklch(0.45_0.06_38_/_0.4)] ring-1 ring-[oklch(0.92_0.006_80)]">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-soft">Total balance</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.93_0.045_155)] px-2 py-0.5 text-xs font-medium text-[oklch(0.46_0.12_155)]">
          <TrendingUp className="size-3" strokeWidth={2.5} aria-hidden />
          2.4%
        </span>
      </div>

      <p className="mt-2 flex items-baseline font-semibold tracking-tight tabular-nums text-ink">
        <span className="text-[2.5rem] leading-none">₱128,430</span>
        <span className="text-2xl text-ink-faint">.55</span>
      </p>
      <p className="mt-2 text-sm tabular-nums text-ink-faint">+ ₱3,012 this month</p>

      <svg viewBox="0 0 320 88" className="mt-5 h-20 w-full" fill="none" aria-hidden>
        <defs>
          <linearGradient id="auth-spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.6 0.14 155)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="oklch(0.6 0.14 155)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#auth-spark-fill)" />
        <path
          d={line}
          stroke="oklch(0.56 0.14 155)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="mt-5 space-y-3 border-t border-[oklch(0.93_0.005_85)] pt-5">
        <PreviewRow color="oklch(0.72 0.16 28)" label="Operating" amount="₱84,210.00" />
        <PreviewRow color="oklch(0.7 0.1 232)" label="Savings vault" amount="₱44,220.55" />
      </div>
    </div>
  );
}

interface PreviewRowProps {
  color: string;
  label: string;
  amount: string;
}

function PreviewRow({ color, label, amount }: PreviewRowProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2.5 text-sm font-medium text-ink">
        <span className="size-4 rounded-md" style={{ backgroundColor: color }} aria-hidden />
        {label}
      </span>
      <span className="text-sm tabular-nums text-ink-soft">{amount}</span>
    </div>
  );
}
