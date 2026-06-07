/**
 * Skeleton loading state for the /profit-first page.
 * Mirrors the real composition: quiet title → filter row → hero total →
 * allocation bar → ledger rows. Skeletons over spinners (product register).
 */
export default function ProfitFirstLoading() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-7">
      {/* Title */}
      <div className="h-7 w-28 animate-pulse rounded-md bg-muted" />

      {/* Filter row */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-md bg-muted" />
        ))}
      </div>

      <div className="flex flex-col">
        {/* Hero total */}
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2.5">
            <div className="h-4 w-28 animate-pulse rounded-md bg-muted" />
            <div className="h-11 w-52 animate-pulse rounded-md bg-muted md:h-12" />
          </div>
          <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
        </div>

        {/* Allocation bar */}
        <div className="mt-7 h-3 w-full animate-pulse rounded-full bg-muted" />

        {/* Ledger rows */}
        <div className="mt-8 divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-4">
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-10 animate-pulse rounded-md bg-muted" />
              <div className="ml-auto h-4 w-24 animate-pulse rounded-md bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
