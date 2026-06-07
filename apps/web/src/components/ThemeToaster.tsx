'use client';

import { useTheme } from 'next-themes';
import { Toaster } from 'sonner';

/**
 * Theme-aware sonner Toaster. Falls back to dark pre-mount (resolvedTheme is
 * undefined before hydration), matching the app's dark default.
 */
export function ThemeToaster(): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  return <Toaster richColors theme={resolvedTheme === 'light' ? 'light' : 'dark'} />;
}
