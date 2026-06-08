'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CircleUser, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { UserProfile } from '@/types/user';

interface UserMenuProps {
  /** SSR-fetched profile from GET /api/auth/me; null when the fetch failed. */
  user: UserProfile | null;
}

/** First letters of the first two name words — "Ørjan Bognot" → "ØB". */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

/**
 * Account menu in the top bar — the only Settings entry point on mobile
 * (BottomNav stays at 5 primary tabs per platform tab-bar guidance) and the
 * only logout control anywhere. Avatar shows the user's initials, falling
 * back to a generic icon when the profile fetch failed; the menu itself
 * still works in that case since Settings and logout don't need the profile.
 *
 * Logout POSTs the same-origin BFF proxy (relays the API's cookie-clearing
 * Set-Cookie headers), then hard-navigates to /login to drop client state.
 */
export function UserMenu({ user }: UserMenuProps): React.JSX.Element {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout(): Promise<void> {
    setIsLoggingOut(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) throw new Error(`logout failed: ${res.status}`);
      // Full navigation (not router.push) so all client state is dropped
      window.location.assign('/login');
    } catch {
      setIsLoggingOut(false);
      toast.error('Could not log out. Please try again.');
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink-faint transition-colors outline-none hover:text-ink-soft focus-visible:text-ink-soft focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {user ? (
            <span className="flex size-6 items-center justify-center rounded-full bg-ink/10 text-[10px] font-semibold text-ink-soft">
              {initialsOf(user.name)}
            </span>
          ) : (
            <CircleUser className="size-4" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {user && (
          <>
            <DropdownMenuLabel>
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {/* Admin entry — ADMIN role only; the API enforces the same gate (403) */}
        {user?.role === 'ADMIN' ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck className="size-4" />
              Admin
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isLoggingOut}
          onSelect={(event) => {
            // Keep the menu open while the request is in flight
            event.preventDefault();
            void handleLogout();
          }}
        >
          <LogOut className="size-4" />
          {isLoggingOut ? 'Logging out…' : 'Log out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
