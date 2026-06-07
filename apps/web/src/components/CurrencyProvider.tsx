'use client';

import { createContext, useContext } from 'react';

import { formatCurrency } from '@/lib/format-currency';
import type { CurrencyCode } from '@/lib/format-currency';

// Re-export for consumers who only need the type
export type { CurrencyCode };

interface CurrencyContextValue {
  currency: CurrencyCode;
}

/**
 * Context holding the user's selected display currency.
 * Default value 'PHP' so any component rendered outside the provider
 * (e.g. in tests or Storybook) still works without crashing.
 */
const CurrencyContext = createContext<CurrencyContextValue>({ currency: 'PHP' });

interface CurrencyProviderProps {
  currency: CurrencyCode;
  children: React.ReactNode;
}

/**
 * Layout-level provider that makes the user's display currency available
 * to all client components via useCurrency() and useFormatCurrency().
 * Wrap the dashboard shell children with this after fetching settings SSR.
 */
export function CurrencyProvider({ currency, children }: CurrencyProviderProps) {
  return <CurrencyContext.Provider value={{ currency }}>{children}</CurrencyContext.Provider>;
}

/**
 * Returns the user's current display currency code.
 * @example const { currency } = useCurrency(); // 'PHP' | 'USD' | ...
 */
export function useCurrency(): CurrencyCode {
  return useContext(CurrencyContext).currency;
}

/**
 * Returns a pre-bound formatCurrency function using the user's chosen currency.
 * Replaces direct `import { formatCurrency }` calls in client components so all
 * monetary values honor the user's display currency setting (SET-01).
 *
 * @example
 * const formatCurrency = useFormatCurrency();
 * formatCurrency(10000) // '₱100.00' or '$100.00' depending on user setting
 */
export function useFormatCurrency(): (cents: number) => string {
  const currency = useCurrency();
  return (cents: number) => formatCurrency(cents, currency);
}
