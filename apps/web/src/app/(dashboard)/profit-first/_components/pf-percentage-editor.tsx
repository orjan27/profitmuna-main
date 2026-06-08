'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { updatePercentagesAction } from '@/server/profit-first-actions';
import type { PfAccount } from './pf-overview';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PfPercentageEditorProps {
  accounts: PfAccount[];
  onCancel: () => void;
}

interface RowState {
  id: number;
  name: string;
  color: string;
  /** Whole-number percent (0–100) — editor NEVER works in basis points (Pitfall 3) */
  displayPercent: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Inline bulk percentage editor panel.
 *
 * Renders one row per account: color dot + name + integer percent input.
 * Live total shows green ✓ when exactly 100%; destructive ✗ otherwise.
 * Save button is disabled unless total === 100.
 *
 * On save: calls updatePercentagesAction (which converts each percent to basis
 * points before calling PUT /api/profit-first/percentages).
 *
 * CRITICAL: This component NEVER touches basis points (no 10000 check).
 * The total gate is always `total === 100` (Pitfall 3).
 */
export function PfPercentageEditor({ accounts, onCancel }: PfPercentageEditorProps) {
  const router = useRouter();
  const [rows, setRows] = useState<RowState[]>(() =>
    accounts.map((a) => ({
      id: a.id,
      name: a.name,
      color: a.color,
      // API returns targetPercentage as whole-number percent (bp/100) — read directly
      displayPercent: a.targetPercentage,
    }))
  );
  const [submitting, setSubmitting] = useState(false);

  // Live total — always percent (0–100 per row), not basis points
  const total = rows.reduce(
    (sum, row) => sum + (Number.isFinite(row.displayPercent) ? row.displayPercent : 0),
    0
  );
  const isValid = total === 100;

  function handleChange(id: number, raw: string) {
    // Allow the input to be empty while editing; treat as 0 in total calc
    const parsed = raw === '' ? 0 : parseInt(raw, 10);
    const value = Number.isNaN(parsed) ? 0 : Math.min(100, Math.max(0, parsed));
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, displayPercent: value } : r)));
  }

  async function handleSave() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      const result = await updatePercentagesAction(
        rows.map((r) => ({ id: r.id, targetPercentage: r.displayPercent }))
      );
      if (!result.ok) {
        toast.error(result.message ?? 'Something went wrong. Please try again.');
        return;
      }
      toast.success('Allocation percentages saved.');
      router.refresh();
      onCancel(); // return to cards view
    } catch {
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-semibold leading-tight">Edit Percentages</h2>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>

      <Separator />

      {/* Rows */}
      <div className="flex flex-col gap-5">
        {rows.map((row) => (
          <div key={row.id} className="flex flex-col gap-2.5">
            {/* Label line: color dot + name + percent input */}
            <div className="flex items-center gap-3">
              {/* Color dot */}
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: row.color }}
                aria-hidden="true"
              />
              {/* Account name */}
              <span className="flex-1 text-sm">{row.name}</span>
              {/* Percent input */}
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={row.displayPercent}
                  onChange={(e) => handleChange(row.id, e.target.value)}
                  className="w-20 text-right tabular-nums"
                  aria-label={`${row.name} percentage`}
                  disabled={submitting}
                />
                <span className="text-sm text-muted-foreground w-4">%</span>
              </div>
            </div>
            {/* Slider — coarse adjust, synced with the input above */}
            <Slider
              value={[row.displayPercent]}
              onValueChange={(values) => handleChange(row.id, String(values[0]))}
              min={0}
              max={100}
              step={1}
              disabled={submitting}
              aria-label={`${row.name} percentage slider`}
              style={{ '--slider-accent': row.color } as CSSProperties}
              className="[&_[data-slot=slider-range]]:bg-[var(--slider-accent)] [&_[data-slot=slider-thumb]]:border-[var(--slider-accent)]"
            />
          </div>
        ))}
      </div>

      <Separator />

      {/* Total line + Save — stacks on mobile with a full-width touch-height
          Save; inline label-left / button-right at md+. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <span
          className={cn('text-sm font-medium', isValid ? 'text-green-600' : 'text-destructive')}
        >
          {isValid ? 'Total: 100% ✓' : `Total: ${total}% — must equal 100% to save`}
        </span>
        <Button
          onClick={handleSave}
          disabled={!isValid || submitting}
          className={cn('max-md:h-11 max-md:w-full', !isValid && 'opacity-50 pointer-events-none')}
        >
          {submitting ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
