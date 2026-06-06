import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Skeleton loading state for the /profit-first page.
 * Matches the 2-col md / 1-col mobile account-card grid (UI-SPEC A4).
 */
export default function ProfitFirstLoading() {
  return (
    <div className="flex flex-col gap-8">
      {/* Page header skeleton */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-36 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-md bg-muted" />
        ))}
      </div>

      {/* Account cards grid skeleton */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-2">
                  <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
                  <div className="h-3.5 w-20 animate-pulse rounded-md bg-muted" />
                </div>
                <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="h-7 w-28 animate-pulse rounded-md bg-muted" />
              <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
              <div className="h-3 w-40 animate-pulse rounded-md bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
