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
 *
 * CurrencyProvider (SET-01): fetches the user's display currency setting
 * server-side and wraps children so client components use the correct currency
 * via useFormatCurrency() without prop-drilling. Falls back to 'PHP' on error
 * so the shell never crashes if the settings endpoint is unavailable.
 *
 * NOTIF-01: fetches unread-count + recent notifications server-side and passes
 * them to DashboardNav for the bell badge. Falls back to 0 / empty list on
 * error so the shell never crashes if the notifications endpoint is unavailable.
 */
import { BottomNav } from '@/components/BottomNav';
import { DashboardNav } from '@/components/DashboardNav';
import { RecordFab } from '@/components/RecordFab';
import { RecordSheetProvider } from '@/components/RecordSheetProvider';
import { CurrencyProvider } from '@/components/CurrencyProvider';
import { apiFetch } from '@/server/api';
import type { CurrencyCode } from '@/lib/format-currency';
import type { UserSettings } from '@/types/settings';
import type { Notification } from '@/types/notifications';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Fetch user's display currency; fall back to PHP if unavailable (shell must never crash)
  let displayCurrency: CurrencyCode = 'PHP';
  try {
    const { data: settings } = await apiFetch<{ data: UserSettings }>('/api/settings');
    displayCurrency = settings.displayCurrency;
  } catch {
    // Unauthenticated, network error, or settings not yet created — PHP default is safe
  }

  // Fetch notifications + unread count for the bell badge (NOTIF-01).
  // Both calls are independent; fall back to empty defaults on any error so the
  // shell never crashes if the notifications endpoint is unavailable.
  let notifications: Notification[] = [];
  let unreadCount = 0;
  try {
    const [notifRes, countRes] = await Promise.all([
      apiFetch<{ data: Notification[] }>('/api/notifications?limit=50'),
      apiFetch<{ data: { count: number } }>('/api/notifications/unread-count'),
    ]);
    notifications = notifRes.data;
    unreadCount = countRes.data.count;
  } catch {
    // Unauthenticated, network error, or notifications not available — empty defaults are safe
  }

  return (
    <RecordSheetProvider>
      <div className="min-h-screen bg-background">
        <DashboardNav unreadCount={unreadCount} notifications={notifications} />
        <main className="mx-auto w-full max-w-6xl px-4 pt-10 pb-24 max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-8">
          <CurrencyProvider currency={displayCurrency}>{children}</CurrencyProvider>
        </main>
        <RecordFab />
        <BottomNav />
      </div>
    </RecordSheetProvider>
  );
}
