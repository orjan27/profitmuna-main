import Image from 'next/image';

import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
  /** Size override for the logo image (height utility, width follows). */
  markClassName?: string;
}

/**
 * Renders the full ProfitMuna brand logo from public/profitmuna-logo.webp —
 * the original stacked lockup (glyph above the navy "PROFITMUNA" wordmark)
 * shown as-is, with no cropping or recoloring.
 */
export function BrandMark({ className, markClassName }: BrandMarkProps): React.JSX.Element {
  return (
    <Image
      src="/profitmuna-logo.webp"
      alt="ProfitMuna"
      width={189}
      height={94}
      className={cn('h-9 w-auto', markClassName, className)}
    />
  );
}
