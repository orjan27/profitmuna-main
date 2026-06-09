interface JarGlyphProps {
  className?: string;
}

/**
 * A mason-jar glyph used across the Profit Muna surface. Reads as a jar
 * through three cues: a lid that overhangs the mouth, shoulders that flare
 * from a narrow neck out to a wider body, and a rounded base. Drawn as strokes
 * so it inherits `currentColor` and sizes via `className` like a lucide icon.
 */
export function JarGlyph({ className }: JarGlyphProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Lid (screw band) — overhangs the neck */}
      <rect x="6.5" y="2" width="11" height="3.2" rx="1.1" />
      {/* Glass body — narrow neck, flared shoulders, rounded base */}
      <path d="M8 5.2h8c0 1.4 3 1.9 3 4v8.6c0 1.5-1.2 2.7-2.7 2.7H7.7C6.2 20.5 5 19.3 5 17.8V9.2c0-2.1 3-2.6 3-4Z" />
      {/* Contents line */}
      <path d="M5.4 13h13.2" />
    </svg>
  );
}
