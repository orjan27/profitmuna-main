import { cn } from '@/lib/utils';

interface StatTileProps {
  /**
   * Small uppercase label above the figure (e.g. "TOTAL IN VIEW"). Accepts a
   * node so callers can trail a badge (e.g. the best-month star) on the label
   * line, clear of the figure and its controls.
   */
  label: React.ReactNode;
  /**
   * The figure line. Callers compose it so each tile can pair the amount with
   * what it needs — a MaskedAmount + Stella star, an amount + trend pill, etc.
   */
  children: React.ReactNode;
  /** Quiet supporting line below the figure. */
  caption?: React.ReactNode;
  className?: string;
}

/**
 * One tile in the ledger analytics band. Pure chrome: a flat card, a tracked
 * label, the caller-composed figure, and a quiet caption. Deliberately NOT the
 * banned hero-metric template — these sit in a row of differentiated tiles, the
 * figures are ink (color means money lives on the charts and rows), and the
 * primary total is sized up by the caller, not by a gradient accent.
 */
export function StatTile({
  label,
  children,
  caption,
  className,
}: StatTileProps): React.JSX.Element {
  return (
    <div className={cn('rounded-3xl bg-card p-5', className)}>
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.12em] text-ink-faint uppercase">
        {label}
      </p>
      <div className="mt-2.5">{children}</div>
      {caption ? <div className="mt-1.5 text-sm text-ink-faint">{caption}</div> : null}
    </div>
  );
}
