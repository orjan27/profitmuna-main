/** Skeleton for the expense ledger — header, then date-grouped row stubs. */
export default function Loading() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col" aria-hidden="true">
      <div className="h-6 w-28 animate-pulse rounded bg-raised/50" />
      <div className="mt-3 h-4 w-44 animate-pulse rounded bg-raised/50" />

      <div className="mt-12 h-3 w-14 animate-pulse rounded bg-raised/50" />
      <div className="mt-3 flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-11 animate-pulse rounded bg-raised/40" />
        ))}
      </div>
    </div>
  );
}
