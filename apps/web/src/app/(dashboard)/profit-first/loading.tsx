/**
 * Skeleton loading state for the /profit-first page.
 * Mirrors the real composition: header → segmented filter → hero total → row
 * of jars → status banner → foot actions. Skeletons over spinners (product
 * register).
 */
export default function ProfitFirstLoading() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* Header: title + tagline, jar-count pill */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-36 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-44 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
      </div>

      {/* Segmented filter bar */}
      <div className="h-9 w-full max-w-md animate-pulse rounded-full bg-muted" />

      <div className="flex flex-col gap-7">
        {/* Hero total */}
        <div className="flex flex-col gap-2.5">
          <div className="h-4 w-44 animate-pulse rounded-md bg-muted" />
          <div className="h-11 w-56 animate-pulse rounded-md bg-muted md:h-12" />
        </div>

        {/* Jars */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col">
              <div className="h-32 animate-pulse rounded-2xl bg-muted sm:h-36" />
              <div className="mx-auto mt-2.5 h-4 w-20 animate-pulse rounded-md bg-muted" />
              <div className="mx-auto mt-1.5 h-4 w-16 animate-pulse rounded-md bg-muted" />
            </div>
          ))}
        </div>

        {/* Status banner */}
        <div className="h-14 w-full animate-pulse rounded-2xl bg-muted" />

        {/* Foot actions */}
        <div className="flex items-center justify-between">
          <div className="h-9 w-28 animate-pulse rounded-full bg-muted" />
          <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}
