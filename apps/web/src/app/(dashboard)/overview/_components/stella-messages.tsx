'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StellaSprite, useIdleWink, type StellaMood } from '@/components/Stella';

/** How long each message stays on screen before Stella moves to the next. */
const ROTATE_INTERVAL_MS = 5000;

interface StellaMessagesProps {
  mood: StellaMood;
  /** Time-of-day greeting line, e.g. "Good afternoon" */
  greeting: string;
  /** Full name for the greeting heading — null renders a name-less greeting */
  userName: string | null;
  /** Message pool — rotates every 5s; a single message renders statically */
  messages: readonly string[];
  /** Opens the Record sheet — the bubble's one primary action */
  onAdd: () => void;
}

/**
 * The overview greeting: Stella beside a bold greeting heading, with her
 * rotating caption in a speech bubble that also carries the page's primary
 * Add action (Playful Bento layout).
 *
 * Messages auto-advance every 5 seconds with the app's rise (slide-up) entry
 * animation — re-keying the <p> replays it. Clicking Stella advances
 * immediately; the interval effect depends on `index`, so a manual advance
 * also restarts the 5-second window. Under `prefers-reduced-motion` the text
 * still rotates but swaps without sliding.
 */
export function StellaMessages({
  mood,
  greeting,
  userName,
  messages,
  onAdd,
}: StellaMessagesProps): React.JSX.Element {
  const displayedMood = useIdleWink(mood, mood === 'smiling');
  const [index, setIndex] = useState(0);

  // Clamp via modulo so a shrinking pool (e.g. privacy toggle) never strands
  // the index out of range.
  const safeIndex = messages.length > 0 ? index % messages.length : 0;

  useEffect(() => {
    if (messages.length < 2) return;
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(interval);
    // `index` is a dependency on purpose: a manual click restarts the 5s timer.
  }, [messages.length, index]);

  function handleAdvance() {
    if (messages.length < 2) return;
    setIndex((i) => (i + 1) % messages.length);
  }

  const firstName = userName?.trim().split(/\s+/)[0] ?? null;

  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={handleAdvance}
        aria-label="Show Stella's next message"
        className="shrink-0 cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <StellaSprite mood={displayedMood} size={64} animated decorative />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="pt-1 text-2xl font-bold tracking-tight">
          {firstName ? `${greeting}, ${firstName}!` : `${greeting}!`}
        </h1>
        {/* Speech bubble: rotating caption + the page's one primary action */}
        <div className="relative mt-3 flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
          {/* Tail pointing back at Stella */}
          <span
            aria-hidden="true"
            className="absolute top-2.5 -left-1 h-3 w-3 rotate-45 rounded-[2px] bg-card"
          />
          {/* Re-keying replays the rise animation on every message change */}
          <p
            key={safeIndex}
            className="animate-rise min-w-0 flex-1 text-sm leading-snug text-ink-soft motion-reduce:animate-none"
          >
            {messages[safeIndex]}
          </p>
          <Button onClick={onAdd} className="shrink-0 rounded-full">
            <Plus aria-hidden="true" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
