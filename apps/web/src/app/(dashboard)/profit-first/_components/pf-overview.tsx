'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MoreVertical } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { MaskedAmount } from '@/components/amount-visibility';
import { deleteAccountAction } from '@/server/profit-first-actions';
import { PfAccountForm } from './pf-account-form';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Shape returned by GET /api/profit-first/summary accounts array */
export interface PfAccount {
  id: number;
  name: string;
  /** Whole-number percent (e.g. 5 = 5%) — API returns bp/100 */
  targetPercentage: number;
  color: string;
  sortOrder: number;
  accountType: 'PROFIT' | 'OWNERS_PAY' | 'TAX' | 'OPEX' | 'CUSTOM';
  /** Derived balance in integer cents */
  computedBalance: number;
}

interface PfOverviewProps {
  accounts: PfAccount[];
  visible: boolean;
  mounted: boolean;
}

/**
 * The jars: one card per allocation account, the liquid rising from the bottom
 * to the account's target percentage. The percentage is the hero of each jar;
 * the name and allocated amount sit beneath it.
 *
 * The fill renders from config (targetPercentage), so the picture stays
 * meaningful even when amounts are masked or income is zero.
 *
 * T-03-06: account.name is always rendered as text content (never
 * dangerouslySetInnerHTML) to prevent stored XSS.
 */
export function PfOverview({ accounts, visible, mounted }: PfOverviewProps) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-3xl bg-card py-16 text-center">
        <p className="text-lg font-semibold">No jars yet</p>
        <p className="mx-auto mt-2 max-w-xs text-sm text-ink-soft">
          Your default jars are created when you sign up. Try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {accounts.map((account) => (
        <JarCard key={account.id} account={account} visible={visible} mounted={mounted} />
      ))}
    </ul>
  );
}

// ── Jar card ──────────────────────────────────────────────────────────────────

/**
 * The glass body of a mason jar in the 52×50 viewBox: a squat, wide vessel with
 * a narrow mouth, gentle shoulders flaring to a broad body, and a rounded base.
 * Shared by the interior fill, the liquid clip, and the outline so they
 * register exactly.
 */
const JAR_BODY =
  'M16 8H36C36 11 48 12 48 16V43C48 46.5 45 48 42 48H10C7 48 4 46.5 4 43V16C4 12 16 11 16 8Z';
/** Liquid spans the glass vertically between these viewBox y-coordinates. */
const GLASS_TOP = 8;
const GLASS_BOTTOM = 48;

interface JarCardProps {
  account: PfAccount;
  visible: boolean;
  mounted: boolean;
}

function JarCard({ account, visible, mounted }: JarCardProps) {
  const router = useRouter();
  const isDefault = account.accountType !== 'CUSTOM';

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Clamp so a stray >100 (or negative) value can never overflow the jar body.
  const fillPercent = Math.min(100, Math.max(0, account.targetPercentage));
  // The percentage label sits at the body's center; once the liquid covers it
  // the digits need a light-on-color treatment. Near-white, not pure (No Pure
  // Extremes). The label sits at ~57% down, so the liquid reaches it near 50%.
  const labelOnFill = fillPercent >= 50;
  // Top edge of the liquid in viewBox units: full glass at 100%, empty at 0%.
  const fillTopY = GLASS_BOTTOM - (fillPercent / 100) * (GLASS_BOTTOM - GLASS_TOP);

  async function handleDelete() {
    setDeleting(true);
    try {
      const result = await deleteAccountAction(account.id);
      if (!result.ok) {
        toast.error(result.message ?? 'Something went wrong. Please try again.');
        return;
      }
      toast.success('Jar deleted.');
      setDeleteOpen(false);
      router.refresh();
    } catch {
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className="flex flex-col">
      {/* The jar itself is the container — no surrounding box. A narrow mouth,
          flared shoulders, and a rounded base read as a jar; the liquid is
          clipped to that exact glass body so it pours into the shape. */}
      <div className="group relative mx-auto aspect-[52/50] w-full max-w-[8.5rem]">
        <svg
          viewBox="0 0 52 50"
          role="img"
          aria-label={`${account.name}: ${account.targetPercentage}% allocation`}
          className="h-full w-full"
        >
          <defs>
            <clipPath id={`jar-clip-${account.id}`}>
              <path d={JAR_BODY} />
            </clipPath>
          </defs>

          {/* Empty glass interior */}
          <path d={JAR_BODY} fill="var(--color-raised)" />

          {/* Liquid — clipped to the glass body, rising from the base. */}
          <g clipPath={`url(#jar-clip-${account.id})`}>
            <rect
              x="0"
              width="52"
              y={fillTopY}
              height={GLASS_BOTTOM - fillTopY}
              fill={account.color}
              className="animate-pour motion-reduce:animate-none"
              style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
            />
          </g>

          {/* Glass outline */}
          <path d={JAR_BODY} fill="none" stroke="var(--color-hairline)" strokeWidth="1.5" />

          {/* Lid (screw band) — carries the bucket color so identity reads even
              when the jar is nearly empty. Overhangs the mouth like a real lid. */}
          <rect x="14" y="2" width="24" height="6.5" rx="2.2" fill={account.color} />
        </svg>

        {/* Percentage — centered on the body, just below the shoulders. */}
        <span
          className="pointer-events-none absolute inset-x-0 top-[56%] -translate-y-1/2 text-center text-2xl font-bold tabular-nums sm:text-3xl"
          style={{
            color: labelOnFill ? 'oklch(0.99 0.01 95)' : account.color,
            // Where the liquid line crosses the digits, a soft shadow keeps the
            // light label crisp.
            textShadow: labelOnFill ? '0 1px 3px oklch(0.2 0.02 95 / 0.35)' : undefined,
          }}
        >
          {account.targetPercentage}%
        </span>

        {/* Per-jar actions — quiet until hover/focus, sits in the top corner */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Options for ${account.name}`}
              className={cnJarMenu()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Edit — available for all jar types */}
            <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit</DropdownMenuItem>

            {/* Delete — disabled with tooltip for non-CUSTOM jars (D-05, T-03-07) */}
            {isDefault ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* Wrapper span needed: disabled button swallows pointer events for tooltip */}
                  <span className="block">
                    <DropdownMenuItem disabled className="cursor-not-allowed opacity-50">
                      Delete
                    </DropdownMenuItem>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left">Default jars cannot be deleted.</TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Identity + allocated amount, beneath the jar */}
      <div className="mt-2.5 text-center">
        <p className="flex items-center justify-center gap-1.5 text-sm font-medium">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: account.color }}
          />
          {/* T-03-06: text content only, no dangerouslySetInnerHTML */}
          <span className="truncate">{account.name}</span>
        </p>
        <MaskedAmount
          cents={account.computedBalance}
          visible={visible}
          mounted={mounted}
          className="mt-0.5 block text-sm font-semibold tabular-nums text-ink-soft"
        />
      </div>

      {/* Edit dialog */}
      <PfAccountForm open={editOpen} onOpenChange={setEditOpen} account={account} />

      {/* Delete confirmation dialog (CUSTOM jars only) */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete jar</DialogTitle>
          </DialogHeader>
          {/* T-03-06: name rendered as text content only */}
          <p className="text-sm text-muted-foreground">
            Delete &ldquo;{account.name}&rdquo;? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete jar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

/**
 * Class string for the per-jar options trigger. Stays faint until the jar tile
 * is hovered/focused, sitting in the top-right corner over the page surface.
 */
function cnJarMenu(): string {
  return 'absolute right-0 top-0 h-7 w-7 text-ink-faint opacity-0 transition-opacity hover:bg-transparent hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100';
}
