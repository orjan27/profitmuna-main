/**
 * Authenticated dashboard shell.
 *
 * Auth is enforced by apps/web/src/middleware.ts (redirects to /login when no
 * access_token cookie is present). This layout does not re-implement the guard —
 * it only provides the page surface for nested routes.
 *
 * DashboardNav (a Client Component) is rendered here as a sticky top bar so
 * every authenticated page shares the same navigation without duplicating it.
 * Phase 5 will extend this layout with full dashboard chrome (summary widgets,
 * dashboard page).
 */
import { DashboardNav } from '@/components/DashboardNav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="pt-4 pb-16 px-4 md:px-8 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
