/**
 * Minimal authenticated dashboard shell.
 *
 * Auth is enforced by apps/web/src/middleware.ts (redirects to /login when no
 * access_token cookie is present). This layout does not re-implement the guard —
 * it only provides the page surface for nested routes.
 *
 * Phase 5 will extend this layout with a sidebar nav and full dashboard chrome.
 * When Phase 5 ships, it extends rather than recreates this file.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="pt-12 pb-16 px-4 md:px-8 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
