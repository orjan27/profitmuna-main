/**
 * Authenticated dashboard shell.
 *
 * Auth is enforced by apps/web/src/middleware.ts (redirects to /login when no
 * access_token cookie is present). This layout does not re-implement the guard —
 * it only provides the page surface for nested routes.
 *
 * RecordSheetProvider mounts the global Record sheet once for the whole shell;
 * per-page record buttons and the mobile RecordFab open it via useRecordSheet().
 * DashboardNav (a Client Component) renders as a sticky top bar — slim brand
 * bar on mobile, full link bar at md+ — while BottomNav carries primary
 * navigation on mobile. main's mobile bottom padding clears BottomNav plus
 * the home-indicator safe area.
 */
import { BottomNav } from '@/components/BottomNav';
import { DashboardNav } from '@/components/DashboardNav';
import { RecordFab } from '@/components/RecordFab';
import { RecordSheetProvider } from '@/components/RecordSheetProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RecordSheetProvider>
      <div className="min-h-screen bg-background">
        <DashboardNav />
        <main className="mx-auto w-full max-w-6xl px-4 pt-10 pb-24 max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-8">
          {children}
        </main>
        <RecordFab />
        <BottomNav />
      </div>
    </RecordSheetProvider>
  );
}
