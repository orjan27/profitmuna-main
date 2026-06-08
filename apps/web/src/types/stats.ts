/**
 * Analytics aggregate shared by the Income and Expense ledgers. Mirrors the
 * API's IncomeStats / ExpenseStats (identical shape) — all amounts are integer
 * cents. Backs the stat band (period total, month-over-month, recurring) and
 * the two charts (monthly bars, by-source breakdown).
 */
export interface LedgerStats {
  /** Total + record count within the active period ("in view"). */
  period: { total: number; count: number };
  /** Current calendar month total, independent of the period filter. */
  thisMonthTotal: number;
  /** Previous calendar month total, for the month-over-month delta. */
  prevMonthTotal: number;
  /** Highest single calendar month all-time; null when there are no records. */
  bestMonth: { ym: string; total: number } | null;
  /** One bucket per calendar month present in the requested year (`ym` = `YYYY-MM`). */
  monthly: { ym: string; total: number }[];
  /** Category breakdown within the active period, descending by total. */
  bySource: { categoryName: string; total: number; count: number }[];
}

/** API envelope for the `/stats` endpoints. */
export interface LedgerStatsResponse {
  data: LedgerStats;
}
