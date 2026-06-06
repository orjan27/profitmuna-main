import Image from 'next/image';

import { cn } from '@/lib/utils';

interface BrandMarkProps {
  /** Render the product name next to the mark. Defaults to true. */
  withWordmark?: boolean;
  className?: string;
  /** Size override for the mark image (height utility, width follows). */
  markClassName?: string;
  /** Size override for the typeset wordmark. */
  wordmarkClassName?: string;
}

/**
 * Brand lockup: the Profitmuna mark (the pastel pill glyph cropped from
 * public/profitmuna-logo.webp) paired with the product name typeset in the
 * app's own sans. The original wordmark text is navy and unreadable on the
 * dark surface, so the name is always set in ink instead (The One Sans Rule).
 *
 * The mark is the single sanctioned exception to "color means money" — brand
 * identity, kept small so the surface stays monochrome at a squint.
 */
export function BrandMark({
  withWordmark = true,
  className,
  markClassName,
  wordmarkClassName,
}: BrandMarkProps): React.JSX.Element {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Image
        src="/profitmuna-mark.webp"
        alt=""
        aria-hidden="true"
        width={108}
        height={37}
        className={cn('h-[18px] w-auto', markClassName)}
      />
      {withWordmark ? (
        <span
          className={cn('text-[15px] font-semibold tracking-tight text-ink', wordmarkClassName)}
        >
          Profitmuna
        </span>
      ) : null}
    </span>
  );
}
