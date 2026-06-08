'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { runCronNowAction } from '@/app/(dashboard)/admin/_components/admin-actions';
import type { CronRun } from '@/types/admin';

interface ScheduledJobsProps {
  /** Latest hourly-cron run — null before the job has ever run */
  lastRun: CronRun | null;
}

/** "1 income, 2 expenses generated · 3 notifications" — zero-count parts dropped. */
function formatRunCounts(run: CronRun): string {
  const parts: string[] = [];
  if (run.generatedIncomes > 0) {
    parts.push(`${run.generatedIncomes} income${run.generatedIncomes !== 1 ? 's' : ''}`);
  }
  if (run.generatedExpenses > 0) {
    parts.push(`${run.generatedExpenses} expense${run.generatedExpenses !== 1 ? 's' : ''}`);
  }
  const generated = parts.length > 0 ? `${parts.join(', ')} generated` : 'nothing generated';

  const extras: string[] = [];
  if (run.pendingDueNotifications > 0) {
    extras.push(
      `${run.pendingDueNotifications} notification${run.pendingDueNotifications !== 1 ? 's' : ''}`
    );
  }
  if (run.reminderEmails > 0) {
    extras.push(`${run.reminderEmails} reminder email${run.reminderEmails !== 1 ? 's' : ''}`);
  }

  return [generated, ...extras].join(' · ');
}

/**
 * Admin-only Settings card: the hourly job's last run (time + result counts +
 * trigger tag) and a manual "Run now" trigger. Manual runs execute only the
 * idempotent steps (recurring generation + due-income bells) — safe to click
 * repeatedly; reminder emails stay on the hourly schedule.
 */
export function ScheduledJobs({ lastRun: initialLastRun }: ScheduledJobsProps): React.JSX.Element {
  const router = useRouter();
  const [lastRun, setLastRun] = useState(initialLastRun);
  const [isPending, startTransition] = useTransition();

  function handleRunNow() {
    startTransition(async () => {
      const result = await runCronNowAction();
      if ('error' in result) {
        toast.error('Could not run the job. Please try again.');
        return;
      }
      setLastRun(result.data);
      const { generatedIncomes, generatedExpenses } = result.data;
      toast.success(
        generatedIncomes + generatedExpenses > 0
          ? `Job finished — ${formatRunCounts(result.data)}.`
          : 'Job finished — nothing was due.'
      );
      router.refresh();
    });
  }

  return (
    <div className="mt-6 rounded-xl border bg-card shadow-sm p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Scheduled Jobs</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Runs hourly: generates due recurring entries, sends income reminders, and fires
          pending-income alerts.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Recurring entries &amp; reminders</p>
          {lastRun ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Last run {format(new Date(lastRun.ranAt), 'MMM d, h:mm a')} —{' '}
              {formatRunCounts(lastRun)}
              <span className="ml-1.5 text-xs text-ink-faint">
                ({lastRun.trigger === 'MANUAL' ? 'manual' : 'scheduled'})
              </span>
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">Has not run yet.</p>
          )}
        </div>
        <Button onClick={handleRunNow} disabled={isPending} className="shrink-0">
          <Play aria-hidden="true" />
          {isPending ? 'Running…' : 'Run now'}
        </Button>
      </div>

      <p className="text-xs text-ink-faint">
        Manual runs only generate due recurring entries and pending-income alerts — reminder emails
        stay on the hourly schedule so they are never sent twice.
      </p>
    </div>
  );
}
