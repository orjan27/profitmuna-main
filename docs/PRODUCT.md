# Product

## Register

brand

> Marketing-first: the public landing/marketing surface is the primary register. App screens (dashboard, wallets, transactions, allocation settings) run in the product register per task.

## Users

Individuals managing their own money with the Profit Muna method. Single-user: each person sees only their own finances. They arrive in everyday contexts — on a laptop or phone, often right after getting paid or making a purchase — wanting one thing fast: record the money and see exactly how it splits across their buckets (Profit, Owner Pay, Tax, Operating Expenses, custom).

They are not accountants. They chose Profit Muna because it removes math and willpower from budgeting. The interface must do the same: the job to be done is "log it and trust the split," not "analyze my finances."

## Product Purpose

Profitmuna automatically applies Profit Muna percentage allocations to recorded income. Users record income and expenses, configure allocation percentages across accounts, and track money across wallets with computed balances. Success looks like: a user records income in seconds and immediately, without interpretation, knows how much belongs to each bucket.

The marketing surface exists to make that promise feel as calm and effortless as the product delivers it.

## Brand Personality

**Calm. Effortless. Trustworthy.**

The feel is Airbnb-grade hospitality applied to money: warm, human, and frictionless — but expressed through a quiet, monochrome visual language rather than color. Confidence comes from restraint and clarity, not from charts, badges, or decoration. The interface should feel like a well-organized desk at dusk: a warm dark-gray surface, low-glare and calm, everything in its place. (Confirmed 2026-06-06: the dark warm-gray posture won over an earlier "white, airy" direction.)

Voice: plain language, friendly, zero finance jargon. "Your profit bucket" beats "allocation entity."

## Anti-references

- **Generic SaaS template**: cookie-cutter shadcn dashboards, hero-metric cards (big number, small label, gradient accent), identical icon-heading-text card grids.
- **Colorful brand palettes**: multi-accent dashboards, gradient heroes, decorative color. Color in Profitmuna is semantic only.
- **Serious navy-and-gold fintech**: banking-app gravitas, dense walls of numbers, chart-heavy analytics screens.

## Design Principles

1. **Quiet by default; color means money.** The surface is monochrome — white, warm grays, near-black. When color appears, it carries financial meaning (income, expense, allocation state) and nothing else. Its rarity is what makes it legible.
2. **The split is the hero.** Every screen's first job is answering "how much belongs where." Typography and hierarchy serve that answer; everything else is secondary.
3. **Airbnb-grade ease.** One primary action per screen. Forgiving flows, obvious next steps, plain-language labels. If a first-time user hesitates, the screen has failed.
4. **Whitespace is the layout.** Generous spacing and typographic scale create structure. Reach for space and type before boxes, borders, or cards.
5. **Trust through restraint.** No gamification, no decoration, no noise. Money software earns trust by being precise and calm.

## Accessibility & Inclusion

- WCAG 2.1 AA: ≥4.5:1 text contrast, visible focus states, full keyboard navigation, `prefers-reduced-motion` respected.
- Because the palette is monochrome with semantic color, **never encode meaning by color alone**: positive/negative amounts always pair color with sign, label, or icon.
- Tabular numerals for all monetary figures so columns of amounts align and scan.
