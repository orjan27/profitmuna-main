'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFormatCurrency } from '@/components/CurrencyProvider';

const STORAGE_KEY = 'pf-amounts-visible';

/**
 * Hook that manages amount visibility state with localStorage persistence.
 *
 * SSR safety: `visible` is guarded by `mounted` — on the server and before
 * the effect runs both are false, so `visible` is always false. This prevents
 * the hydration mismatch described in RESEARCH.md Pitfall 7.
 *
 * @returns { visible, toggle, mounted }
 */
export function useAmountVisibility(): { visible: boolean; toggle: () => void; mounted: boolean } {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem(STORAGE_KEY) === 'true') {
      setVisible(true);
    }
  }, []);

  const toggle = useCallback(() => {
    setVisible((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return { visible: mounted && visible, toggle, mounted };
}

interface AmountToggleProps {
  visible: boolean;
  toggle: () => void;
}

/**
 * Icon-only button that toggles amount visibility.
 * Uses Eye (show) / EyeOff (hide) lucide icons with tooltip labels.
 * Minimum 44px touch target via padding (accessibility requirement).
 */
export function AmountToggle({ visible, toggle }: AmountToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={visible ? 'Hide amounts' : 'Show amounts'}
          className="min-h-[44px] min-w-[44px]"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{visible ? 'Hide amounts' : 'Show amounts'}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface MaskedAmountProps {
  /** Amount in integer cents (e.g. 10000 = ₱100.00) */
  cents: number;
  visible: boolean;
  mounted: boolean;
  className?: string;
}

/**
 * Renders the formatted currency amount when `mounted && visible`,
 * otherwise renders `••••••` in the same Display typographic slot.
 *
 * SSR always renders masked state to avoid hydration mismatch (Pitfall 7).
 * The `mounted` flag ensures client hydration matches the server render.
 */
export function MaskedAmount({ cents, visible, mounted, className }: MaskedAmountProps) {
  const formatCurrency = useFormatCurrency();
  // mounted && visible is the hydration-safe guard — SSR always renders masked
  const shouldShow = mounted && visible;

  return (
    <span className={className}>
      {shouldShow ? formatCurrency(cents) : <span aria-hidden="true">••••••</span>}
    </span>
  );
}
