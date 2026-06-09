/** Recurrence frequency for recurring income/expense templates. */
export type RecurFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

/** Recurrence fields shared by both template types and the form fieldset. */
export interface RecurrenceSchedule {
  frequency: RecurFrequency;
  /** 0–6 (Sun–Sat); set for WEEKLY */
  dayOfWeek: number | null;
  /** 1–31; set for MONTHLY and BIWEEKLY (clamped to short months server-side) */
  dayOfMonth: number | null;
  /** 1–31; second day for BIWEEKLY */
  dayOfMonth2: number | null;
}

/** A recurring income template — mirrors the API RecurringIncomeRecord. */
export interface RecurringIncome extends RecurrenceSchedule {
  id: number;
  categoryId: number;
  categoryName: string;
  /** Integer cents; null = "amount set on receive" */
  amount: number | null;
  description: string | null;
  profitMunaAllocated: boolean;
  active: boolean;
  lastGeneratedDate: string | null;
  userId: number;
  createdAt: string | null;
  updatedAt: string | null;
}

/** A recurring expense template — mirrors the API RecurringExpenseRecord. */
export interface RecurringExpense extends RecurrenceSchedule {
  id: number;
  categoryId: number;
  categoryName: string;
  /** Integer cents — always exact for auto-record */
  amount: number;
  description: string | null;
  walletId: number;
  walletName: string | null;
  active: boolean;
  lastGeneratedDate: string | null;
  userId: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RecurringIncomeListResponse {
  data: RecurringIncome[];
}

export interface RecurringExpenseListResponse {
  data: RecurringExpense[];
}
