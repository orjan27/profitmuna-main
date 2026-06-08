// Pure utility — no React imports, no framework coupling (CLAUDE.md: lib/ for framework-agnostic utils)

/**
 * YIQ brightness check — light swatches (e.g. Amber) get pre-darkened so the
 * card's white text keeps enough contrast against the wallet color.
 */
export function isLightColor(hex: string): boolean {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

/**
 * The shared bank-card gradient — used by both the wallets-list card stack
 * and the wallet-detail hero so the two surfaces stay visually identical.
 *
 * @param color - The wallet's stored hex color
 * @returns CSS `background-image` value
 */
export function walletCardGradient(color: string): string {
  const base = isLightColor(color) ? `color-mix(in oklab, ${color}, black 14%)` : color;
  return `linear-gradient(150deg, color-mix(in oklab, ${base}, white 10%) 0%, ${base} 45%, color-mix(in oklab, ${base}, black 24%) 100%)`;
}
