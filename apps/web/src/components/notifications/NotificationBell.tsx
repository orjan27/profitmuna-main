'use client';

import { Bell } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationList } from '@/components/notifications/NotificationList';
import type { Notification } from '@/types/notifications';

interface NotificationBellProps {
  unreadCount: number;
  notifications: Notification[];
}

/**
 * Bell icon button with unread badge. Opens a DropdownMenu containing the
 * NotificationList panel. Receives SSR-fetched data as props; client-side
 * optimistic updates live in NotificationList.
 *
 * Unread dot: text-foreground when unreadCount > 0, text-muted-foreground otherwise.
 * Badge: destructive variant, capped at "9+" — matches platform convention (iOS, Gmail).
 */
export function NotificationBell({
  unreadCount,
  notifications,
}: NotificationBellProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 shrink-0"
          aria-label="Notifications"
        >
          <Bell
            className={cn('h-4 w-4', unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground')}
          />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center p-0 text-[10px] font-semibold tabular-nums"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <NotificationList notifications={notifications} unreadCount={unreadCount} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
