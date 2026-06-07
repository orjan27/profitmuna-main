'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { Notification } from '@/types/notifications';

interface NotificationListProps {
  notifications: Notification[];
  unreadCount: number;
}

/**
 * Renders the notification panel body: header with "Mark all read" button,
 * scrollable notification rows (newest-first), and a footer Settings link.
 *
 * Optimistic updates: row and count update immediately on click/mark-all;
 * API calls fire in the background. router.refresh() rehydrates SSR state.
 */
export function NotificationList({
  notifications: initialNotifications,
  unreadCount: initialUnreadCount,
}: NotificationListProps): React.JSX.Element {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [markingAll, setMarkingAll] = useState(false);
  const [, startTransition] = useTransition();

  /** Marks a single row read optimistically, fires API in background, then navigates. */
  function handleNotificationClick(notification: Notification) {
    if (!notification.read) {
      // Optimistic update immediately
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Background API call — do not block navigation
      startTransition(async () => {
        try {
          await fetch(`/api/notifications/${notification.id}/read`, { method: 'PUT' });
          router.refresh(); // rehydrate unread count in SSR parent
        } catch {
          toast.error('Could not mark notification as read.');
        }
      });
    }

    if (notification.link) {
      router.push(notification.link);
    }
  }

  /** Marks all unread notifications read optimistically, then fires API. */
  async function handleMarkAllRead() {
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await fetch('/api/notifications/read-all', { method: 'PUT' });
      toast.success('All notifications marked as read.');
      router.refresh();
    } catch {
      toast.error('Could not mark all notifications as read.');
      router.refresh(); // revert optimistic state
    } finally {
      setMarkingAll(false);
    }
  }

  function formatTimestamp(createdAt: string): string {
    try {
      return format(new Date(createdAt), 'MMM d, h:mm a');
    } catch {
      return '';
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm font-semibold">Notifications</span>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            {markingAll ? 'Marking…' : 'Mark all read'}
          </Button>
        )}
      </div>
      <Separator />

      {/* Notification list */}
      <div className="max-h-[400px] overflow-y-auto">
        {notifications.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
            <p className="text-sm font-semibold">No notifications yet</p>
            <p className="text-xs text-muted-foreground">
              You&apos;ll see income reminders and pending income alerts here.
            </p>
          </div>
        ) : (
          notifications.map((notification) => {
            const rowClass = cn(
              'flex flex-col gap-0.5 px-3 py-3 cursor-pointer rounded-md',
              notification.read
                ? 'hover:bg-accent/50 text-muted-foreground'
                : 'bg-accent/50 hover:bg-accent'
            );

            return (
              <div
                key={notification.id}
                className={rowClass}
                onClick={() => handleNotificationClick(notification)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNotificationClick(notification);
                  }
                }}
              >
                {/* Title row with unread dot indicator */}
                <div className="flex items-start gap-1.5">
                  {!notification.read && (
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={cn(
                      'text-sm',
                      notification.read ? 'text-muted-foreground' : 'font-semibold'
                    )}
                  >
                    {notification.title}
                  </span>
                </div>
                {/* Message body */}
                <p className="line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
                {/* Timestamp */}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatTimestamp(notification.createdAt)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <Separator />
      <div className="flex items-center justify-center px-3 py-2">
        <a href="/settings" className="text-xs text-muted-foreground hover:underline">
          Settings
        </a>
      </div>
    </div>
  );
}
