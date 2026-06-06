/** Skeleton for the Overview home — mirrors hero, split bar, and ledger rows. */
export default function Loading() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col" aria-hidden="true">
      <div className="h-4 w-28 animate-pulse rounded bg-raised/50" />
      <div className="mt-4 h-9 w-56 animate-pulse rounded bg-raised/50" />
      <div className="mt-3 h-4 w-32 animate-pulse rounded bg-raised/50" />

      <div className="mt-16 h-3 w-20 animate-pulse rounded bg-raised/50" />
      <div className="mt-5 h-3 w-full animate-pulse rounded-full bg-raised/50" />
      <div className="mt-4 h-3 w-2/3 animate-pulse rounded bg-raised/50" />

      <div className="mt-16 h-3 w-16 animate-pulse rounded bg-raised/50" />
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-11 animate-pulse rounded bg-raised/40" />
        ))}
      </div>
    </div>
  );
}
