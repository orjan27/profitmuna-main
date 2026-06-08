import { apiFetch } from '@/server/api';
import { SettingsForm } from './_components/settings-form';
import { ScheduledJobs } from './_components/scheduled-jobs';
import type { UserSettings } from '@/types/settings';
import type { UserProfile } from '@/types/user';
import type { CronRun } from '@/types/admin';

/**
 * Settings page — Server Component.
 * Fetches current settings server-side for pre-population, then delegates
 * interactive state to the SettingsForm client component.
 *
 * Admins additionally see the Scheduled Jobs section (last cron run + manual
 * trigger) — the API 403s /api/admin/* for everyone else, so the role check
 * here is UX, not the security boundary.
 */
export default async function SettingsPage() {
  const { data: settings } = await apiFetch<{ data: UserSettings }>('/api/settings');

  let lastRun: CronRun | null = null;
  let isAdmin = false;
  try {
    const me = await apiFetch<{ data: UserProfile }>('/api/auth/me');
    if (me.data.role === 'ADMIN') {
      isAdmin = true;
      const res = await apiFetch<{ data: CronRun | null }>('/api/admin/cron/last-run');
      lastRun = res.data;
    }
  } catch {
    // Profile or admin fetch failed — render Settings without the admin section
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-[20px] font-semibold leading-tight mb-6">Settings</h1>
      <SettingsForm initialSettings={settings} />
      {isAdmin ? <ScheduledJobs lastRun={lastRun} /> : null}
    </div>
  );
}
