import Link from 'next/link';

import { Button } from '@/components/ui/button';

/**
 * The hero demonstration: one recorded income, split across the four
 * default Profit First buckets. Bars are a monochrome ink ramp; the
 * only color on the page is the income amount (paired with its sign).
 */
const SPLIT = [
  { name: 'Profit', pct: 10, amount: '$480.00', tone: 'bg-ink' },
  { name: "Owner's Pay", pct: 50, amount: '$2,400.00', tone: 'bg-ink/70' },
  { name: 'Tax', pct: 15, amount: '$720.00', tone: 'bg-ink/45' },
  { name: 'Operating Expenses', pct: 25, amount: '$1,200.00', tone: 'bg-ink/25' },
] as const;

const STEPS = [
  {
    title: 'Record income as it lands',
    copy: 'One amount, one date, done. No categories to agonize over, no spreadsheet to open.',
  },
  {
    title: 'Your percentages do the math',
    copy: 'Profit, Owner’s Pay, Tax, Operating Expenses, plus any bucket you add. Set the split once and it applies in full, every time.',
  },
  {
    title: 'Every bucket shows its balance',
    copy: 'Wallets track where the money actually sits. Balances are computed, so nothing drifts and nothing needs reconciling.',
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Profitmuna
        </Link>
        <nav className="flex items-center gap-5">
          <Link href="/register" className="text-sm text-ink-soft transition-colors hover:text-ink">
            Create account
          </Link>
          <Button asChild>
            <Link href="/login">Log in</Link>
          </Button>
        </nav>
      </header>

      <main>
        {/* Hero: the split is the hero, literally */}
        <section className="mx-auto grid w-full max-w-6xl gap-16 px-6 pt-20 pb-28 lg:grid-cols-12 lg:gap-10 lg:pt-28">
          <div className="lg:col-span-7">
            <h1 className="animate-rise text-[clamp(2.75rem,6.5vw,4.75rem)] leading-[1.04] font-semibold tracking-[-0.03em] motion-reduce:animate-none">
              Get paid.
              <br />
              It&rsquo;s already sorted.
            </h1>
            <p
              className="animate-rise mt-7 max-w-[52ch] text-lg leading-relaxed text-ink-soft motion-reduce:animate-none"
              style={{ animationDelay: '90ms' }}
            >
              Profitmuna applies your Profit First percentages the moment you record income. Every
              bucket gets its share automatically, so you always know exactly how much belongs
              where.
            </p>
            <div
              className="animate-rise mt-10 flex flex-wrap items-center gap-4 motion-reduce:animate-none"
              style={{ animationDelay: '180ms' }}
            >
              <Button asChild size="lg" className="px-8 text-base">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="px-8 text-base">
                <Link href="/register">Create an account</Link>
              </Button>
            </div>
          </div>

          <div
            className="animate-rise lg:col-span-5 motion-reduce:animate-none"
            style={{ animationDelay: '140ms' }}
          >
            <div className="rounded-xl border border-hairline bg-card p-7 sm:p-8">
              <p className="text-xs font-medium tracking-[0.14em] text-ink-faint uppercase">
                Income received
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-income tabular-nums">
                +$4,800.00
              </p>

              <div
                className="mt-7 flex h-2 gap-px overflow-hidden rounded-full"
                role="img"
                aria-label="Allocation split: Profit 10%, Owner's Pay 50%, Tax 15%, Operating Expenses 25%"
              >
                {SPLIT.map((bucket, i) => (
                  <div
                    key={bucket.name}
                    className={`animate-fill origin-left ${bucket.tone} motion-reduce:animate-none`}
                    style={{ width: `${bucket.pct}%`, animationDelay: `${250 + i * 110}ms` }}
                  />
                ))}
              </div>

              <ul className="mt-5 divide-y divide-hairline">
                {SPLIT.map((bucket) => (
                  <li
                    key={bucket.name}
                    className="flex items-baseline justify-between gap-4 py-3.5"
                  >
                    <span className="text-sm font-medium">{bucket.name}</span>
                    <span className="ml-auto text-sm text-ink-faint tabular-nums">
                      {bucket.pct}%
                    </span>
                    <span className="w-24 text-right text-sm font-semibold tabular-nums">
                      {bucket.amount}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 border-t border-hairline pt-4 text-sm text-ink-faint">
                Split applied automatically. Nothing left to decide.
              </p>
            </div>
          </div>
        </section>

        {/* How it works: numbered editorial rows, no icon cards */}
        <section className="border-t border-hairline">
          <div className="mx-auto w-full max-w-6xl px-6 py-24">
            <p className="text-xs font-medium tracking-[0.14em] text-ink-faint uppercase">
              How it works
            </p>
            <ol className="mt-4">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="grid gap-2 border-b border-hairline py-12 last:border-b-0 lg:grid-cols-12 lg:gap-6"
                >
                  <span
                    className="text-6xl leading-none font-semibold text-ink/15 tabular-nums lg:col-span-2"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div
                    className={`lg:col-span-6 ${
                      i === 0 ? 'lg:col-start-4' : i === 1 ? 'lg:col-start-5' : 'lg:col-start-6'
                    }`}
                  >
                    <h2 className="text-[clamp(1.5rem,2.8vw,2.125rem)] font-semibold tracking-[-0.015em]">
                      {step.title}
                    </h2>
                    <p className="mt-3 max-w-[52ch] text-base leading-relaxed text-ink-soft">
                      {step.copy}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* The principle: inverted band, still monochrome */}
        <section className="bg-ink text-paper">
          <div className="mx-auto w-full max-w-6xl px-6 py-28">
            <p className="max-w-[20ch] text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.15] font-semibold tracking-[-0.02em]">
              Pay yourself first. Spend what&rsquo;s left.
            </p>
            <p className="mt-6 max-w-[48ch] text-lg leading-[1.8] text-paper/65">
              That&rsquo;s the whole Profit First method. Profitmuna just does it for you, in full,
              every time you get paid.
            </p>
            <p className="mt-14 text-sm tracking-wide text-paper/45">
              Profit &middot; Owner&rsquo;s Pay &middot; Tax &middot; Operating Expenses &middot;
              plus any bucket you add
            </p>
          </div>
        </section>

        {/* Final call */}
        <section className="mx-auto w-full max-w-6xl px-6 py-28">
          <h2 className="max-w-[22ch] text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.1] font-semibold tracking-[-0.02em]">
            Know exactly how much belongs where.
          </h2>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="px-8 text-base">
              <Link href="/login">Log in</Link>
            </Button>
            <Link
              href="/register"
              className="text-base text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              New here? Create an account
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-baseline justify-between gap-4 px-6 py-10">
          <div>
            <p className="font-bold tracking-tight">Profitmuna</p>
            <p className="mt-1 text-sm text-ink-faint">
              Profit First budgeting, applied automatically.
            </p>
          </div>
          <p className="text-sm text-ink-faint">&copy; 2026 Profitmuna</p>
        </div>
      </footer>
    </div>
  );
}
