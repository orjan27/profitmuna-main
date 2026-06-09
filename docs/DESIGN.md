---
name: Profitmuna
description: Calm, monochrome Profit Muna budgeting — the split is the hero.
---

<!-- SEED — re-run $impeccable document once there's code to capture the actual tokens and components. -->

# Design System: Profitmuna

## 1. Overview

**Creative North Star: "The Calm Envelope"**

Profit Muna is envelope budgeting without the math. Profitmuna's design system is that promise made visual: a calm, warm-gray surface where money is sorted, labeled, and at rest. The personality is Airbnb-grade hospitality expressed through Linear-grade restraint, with Mercury as proof that money software can feel editorial and calm instead of corporate. The standard posture is a warm dark gray (the Claude.ai dark-surface family) on every page: quiet, low-glare, and easy on the eyes whether the user checks their split at noon or at midnight.

> **Auth-surface exception (confirmed 2026-06-08).** The public auth entry — login, register, forgot/reset password, email verification — runs in the LIGHT theme as a deliberate marketing-grade exception, the one documented departure from the all-pages dark posture. It is a split-screen: a warm off-white form column beside a peach→cream→sage gradient panel previewing a sample balance. This surface also permits warm brand accents (a coral cross-link, the gradient panel, the multi-color Google glyph) beyond the "color means money" rule, because here design serves the brand register, not the in-app product. Implemented in `apps/web/src/components/AuthShell.tsx`; the `light` class on its root flips the shared shadcn controls to dark-on-light.

The system is monochrome. Surfaces are warm dark grays, text is warm off-white, and structure comes from typographic scale and whitespace rather than boxes and borders. When color appears, it means money: income, expense, allocation state. Nothing decorative ever gets a hue. This system explicitly rejects the generic SaaS template — cookie-cutter shadcn dashboards, hero-metric cards, identical icon-heading-text card grids — and equally rejects colorful gradient-brand palettes and serious navy-and-gold fintech gravitas.

Motion is responsive, never choreographed: interactions give smooth, immediate feedback (an allocation split easing into place), but nothing animates for spectacle. Ease-out exponential curves only; no bounce, no elastic.

**Key Characteristics:**

- Monochrome warm-gray surface: dark warm grays, warm off-white text — color is reserved for financial meaning
- Typographic hierarchy and whitespace carry the layout; containers are a last resort
- One humanist sans for everything; hierarchy through size and weight
- One primary action per screen; friendly, jargon-free labels
- Flat at rest; depth appears only as a response to state

## 2. Colors

A warm dark-gray monochrome ramp with a tiny semantic set for money. Source of truth: `apps/web/src/app/globals.css`.

### Primary

- **Warm Off-White Ink** `oklch(0.952 0.005 90)` (#f0efeb): the only "accent." Primary buttons, key numbers, headings. Never pure `#fff` — a warm-tinted off-white.

### Neutral

- **Page Gray (paper)** `oklch(0.268 0.004 100)` (#262624): the standard page background on every page. Never pure `#000`; tinted warm.
- **Deep Gray (paper-deep)** `oklch(0.237 0.004 90)` (#1f1e1c): shell chrome — sidebar and panels (Phase 5 dashboard shell).
- **Warm Gray ramp**: raised fills `oklch(0.315 0.005 100)`, cards `oklch(0.3 0.005 100)`, hairlines `oklch(0.36 0.005 100)`, secondary text `oklch(0.76 0.008 90)`, faint text `oklch(0.68 0.008 90)`. All grays share the same warm tint so the surface feels human, not clinical.

### Semantic (money only)

- **Income / positive** `oklch(0.72 0.13 155)` and **Expense / negative** `oklch(0.68 0.18 25)`: lifted for AA contrast on the dark surface; appear only on amounts and allocation states, always paired with a sign, label, or icon — never color alone.

### Named Rules

**The Color Means Money Rule.** If an element is not a monetary amount or allocation state, it is grayscale. No decorative color, anywhere, ever. Audit test: squint at any screen — the only colored pixels should be money.

**The No Pure Extremes Rule.** `#000` and `#fff` are forbidden. Every neutral carries a faint warm tint.

## 3. Typography

**Body Font:** Single humanist sans `[font pairing to be chosen at implementation]` — warm and friendly (the Airbnb Cereal posture), with a true tabular-numeral set.

**Character:** One voice, many volumes. The entire interface speaks in a single warm sans; hierarchy comes from size and weight contrast (≥1.25 scale ratio between steps), never from switching faces.

### Hierarchy

- **Display** `[scale to be set]`: the big quiet numbers — balances, the income amount being split.
- **Headline / Title / Body / Label** `[scale to be set]`: standard roles; body capped at 65–75ch.

### Named Rules

**The Tabular Money Rule.** Every monetary figure renders in tabular numerals so columns of amounts align and scan. No proportional digits on money.

**The One Sans Rule.** One typeface family across marketing and app. Differentiation through weight and size only.

## 4. Elevation

Flat by default. Depth is conveyed through the warm-gray tonal ramp (background vs. raised-surface tint) and hairline dividers, not shadows. Shadows may appear only as a response to state — a hovered row, an opened popover — and stay soft and low-contrast. No glassmorphism, no decorative blur.

### Named Rules

**The Flat-At-Rest Rule.** A resting screen casts no shadows. If a shadow exists, the user caused it.

## 5. Components

_(Omitted in seed — no components exist yet. The next `$impeccable document` run extracts real button, input, card, and navigation specs from code.)_

## 6. Do's and Don'ts

### Do:

- **Do** make the split the hero: the first readable thing on any screen answers "how much belongs where."
- **Do** build structure from whitespace and type scale before reaching for cards or borders.
- **Do** pair every semantic color with a sign, label, or icon — color never carries meaning alone (WCAG 2.1 AA).
- **Do** keep one primary action per screen with a plain-language label ("Record income", not "New transaction entity").
- **Do** respect `prefers-reduced-motion`; all easing is ease-out exponential.

### Don't:

- **Don't** build the generic SaaS template: no hero-metric cards (big number, small label, gradient accent), no identical icon-heading-text card grids, no cookie-cutter shadcn dashboard shells.
- **Don't** use colorful brand palettes, gradient heroes, or decorative color of any kind — color means money.
- **Don't** drift toward serious navy-and-gold fintech: no dense walls of numbers, no chart-heavy analytics gravitas.
- **Don't** use `#000`, `#fff`, gradient text, side-stripe borders (`border-left` > 1px as accent), glassmorphism, or nested cards.
- **Don't** reach for a modal as the first thought — exhaust inline and progressive disclosure first.
