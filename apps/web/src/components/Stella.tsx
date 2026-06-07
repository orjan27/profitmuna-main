'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

import { cn } from '@/lib/utils';

export type StellaMood = 'smiling' | 'happy' | 'wink' | 'sad' | 'sleeping';

const MOOD_SRC: Record<StellaMood, string> = {
  smiling: '/star-smiling.webp',
  happy: '/star-happy-closed-eyes.webp',
  wink: '/star-wink.webp',
  sad: '/star-sad-teary-eyes.webp',
  sleeping: '/star-sleeping.webp',
};

const MOOD_ALT: Record<StellaMood, string> = {
  smiling: 'Stella the star, smiling',
  happy: 'Stella the star, eyes happily closed',
  wink: 'Stella the star, winking',
  sad: 'Stella the star, teary-eyed',
  sleeping: 'Stella the star, asleep',
};

const ALL_MOODS = Object.keys(MOOD_SRC) as readonly StellaMood[];

interface StellaSpriteProps {
  mood: StellaMood;
  /** Square box size in px (default 48) */
  size?: number;
  /**
   * When true, all five poses stay mounted and mood changes crossfade with a
   * subtle scale pop. Use for live reactions; static surfaces (empty states,
   * toast icons) should leave this off so only one image loads.
   */
  animated?: boolean;
  /** Hide from assistive tech — use when a caption or label carries the meaning. */
  decorative?: boolean;
  className?: string;
}

/**
 * Stella, the app mascot: a gold pixel-art star whose mood reads out the
 * user's financial state. Her color is legal under the Color Means Money
 * rule because she IS the money.
 *
 * @param mood - Which pose to show.
 * @returns The sprite image, optionally crossfading between poses.
 */
export function StellaSprite({
  mood,
  size = 48,
  animated = false,
  decorative = false,
  className,
}: StellaSpriteProps): React.JSX.Element {
  if (!animated) {
    return (
      <Image
        src={MOOD_SRC[mood]}
        alt={decorative ? '' : MOOD_ALT[mood]}
        aria-hidden={decorative || undefined}
        width={size}
        height={size}
        className={cn('object-contain', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : MOOD_ALT[mood]}
      aria-hidden={decorative || undefined}
      className={cn('relative inline-block shrink-0', className)}
      style={{ width: size, height: size }}
    >
      {ALL_MOODS.map((m) => (
        <Image
          key={m}
          src={MOOD_SRC[m]}
          alt=""
          width={size}
          height={size}
          className={cn(
            'absolute inset-0 h-full w-full object-contain',
            'transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none',
            m === mood ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          )}
        />
      ))}
    </span>
  );
}

/**
 * Occasionally swaps a resting `smiling` mood for a brief `wink` so Stella
 * feels alive on long-lived screens. No-ops for any other mood, when
 * disabled, and under `prefers-reduced-motion`.
 *
 * @param mood - The mood the surface computed.
 * @param enabled - Opt-in flag; idle winking is for hero placements only.
 * @returns The mood to actually display.
 */
export function useIdleWink(mood: StellaMood, enabled: boolean): StellaMood {
  const [winking, setWinking] = useState(false);

  useEffect(() => {
    if (!enabled || mood !== 'smiling') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => {
      setWinking(true);
      timeout = setTimeout(() => setWinking(false), 1200);
    }, 25000);
    return () => {
      clearInterval(interval);
      if (timeout) clearTimeout(timeout);
      setWinking(false);
    };
  }, [mood, enabled]);

  return winking && mood === 'smiling' ? 'wink' : mood;
}

interface StellaProps {
  mood: StellaMood;
  /** Plain-language line that carries the meaning — mood never speaks alone. */
  caption: string;
  size?: number;
  animated?: boolean;
  className?: string;
}

/**
 * Sprite + caption row. The caption is real text so the message never rides
 * on the image alone (WCAG: no meaning by appearance only).
 */
export function Stella({
  mood,
  caption,
  size = 32,
  animated = false,
  className,
}: StellaProps): React.JSX.Element {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <StellaSprite mood={mood} size={size} animated={animated} decorative />
      <p className="text-sm text-ink-faint">{caption}</p>
    </div>
  );
}
