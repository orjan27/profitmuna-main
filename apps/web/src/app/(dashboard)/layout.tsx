/**
 * Authenticated dashboard shell.
 *
 * Auth is enforced by apps/web/src/middleware.ts (redirects to /login when no
 * access_token cookie is present). This layout does not re-implement the guard —
 * it only provides the page surface for nested routes.
 *
 * RecordSheetProvider mounts the global Record sheet once for the whole shell;
 * DashboardNav and per-page record buttons open it via useRecordSheet().
 * DashboardNav (a Client Component) renders as a sticky top bar so every
 * authenticated page shares the same navigation without duplicating it.
 */
import { DashboardNav } from '@/components/DashboardNav';
import { RecordSheetProvider } from '@/components/RecordSheetProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RecordSheetProvider>
      <div className="min-h-screen bg-background">
        <DashboardNav />
        <main className="mx-auto w-full max-w-6xl px-4 pt-10 pb-24 md:px-8">{children}</main>
      </div>
    </RecordSheetProvider>
  );
}
