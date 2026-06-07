import { apiFetch } from '@/server/api';
import { SettingsForm } from './_components/settings-form';
import type { UserSettings } from '@/types/settings';

/**
 * Settings page — Server Component.
 * Fetches current settings server-side for pre-population, then delegates
 * interactive state to the SettingsForm client component.
 */
export default async function SettingsPage() {
  const { data: settings } = await apiFetch<{ data: UserSettings }>('/api/settings');

  return (
    <div className="max-w-2xl">
      <h1 className="text-[20px] font-semibold leading-tight mb-6">Settings</h1>
      <SettingsForm initialSettings={settings} />
    </div>
  );
}
