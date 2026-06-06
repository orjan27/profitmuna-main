import type { PfAccount } from './pf-overview';

interface PfAllocationBarProps {
  accounts: PfAccount[];
}

/**
 * The one picture that answers "how much belongs where": a single stacked
 * 100% bar whose segments are the configured allocation percentages, in
 * account colors. Renders from config (targetPercentage), so it stays
 * meaningful even when amounts are masked or income is zero.
 *
 * Motion: the whole bar eases in with the `fill` keyframe (scaleX 0→1,
 * ease-out expo) once on load; disabled under prefers-reduced-motion.
 * Pure presentational component, server-safe (no hooks).
 */
export function PfAllocationBar({ accounts }: PfAllocationBarProps) {
  if (accounts.length === 0) return null;

  return (
    <div
      role="img"
      aria-label={`Allocation split: ${accounts
        .map((a) => `${a.name} ${a.targetPercentage}%`)
        .join(', ')}`}
    >
      <div className="origin-left animate-fill motion-reduce:animate-none flex h-3 w-full gap-[3px] overflow-hidden rounded-full">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="h-full"
            style={{
              width: `${account.targetPercentage}%`,
              backgroundColor: account.color,
            }}
            title={`${account.name} · ${account.targetPercentage}%`}
          />
        ))}
      </div>
    </div>
  );
}
