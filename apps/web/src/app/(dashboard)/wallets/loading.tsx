/** Skeleton for the wallet card deck — header, then overlapping card stubs. */
export default function Loading() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col" aria-hidden="true">
      <div className="h-6 w-24 animate-pulse rounded bg-raised/50" />
      <div className="mt-3 h-4 w-44 animate-pulse rounded bg-raised/50" />

      <div className="mx-auto mt-10 flex w-full max-w-md flex-col [&>div+div]:-mt-11">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="h-52 animate-pulse rounded-[1.75rem] border-t border-paper bg-raised"
          />
        ))}
      </div>
    </div>
  );
}
