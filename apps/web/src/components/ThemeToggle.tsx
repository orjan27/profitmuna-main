'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

/**
 * Quiet ghost icon button matching the nav-link idiom: Sun in dark mode,
 * Moon in light. Mounted-state guard because useTheme resolves only after
 * hydration; a fixed-size placeholder prevents layout shift in the navbar.
 */
export function ThemeToggle(): React.JSX.Element {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme !== 'light';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={
        mounted ? (isDark ? 'Switch to light mode' : 'Switch to dark mode') : 'Toggle theme'
      }
      className="inline-flex size-9 items-center justify-center rounded-md text-ink-faint transition-colors outline-none hover:text-ink-soft focus-visible:text-ink-soft focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {mounted ? (
        isDark ? (
          <Sun className="size-4" />
        ) : (
          <Moon className="size-4" />
        )
      ) : (
        <span className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
