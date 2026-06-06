/** Income record as returned by the API. Amount is integer cents. */
export interface Income {
  id: number;
  categoryId: number;
  categoryName: string;
  amount: number;
  description: string | null;
  incomeDate: string;
  moneyStatus: 'RECEIVED' | 'PENDING';
  expectedReleaseDate: string | null;
  receivedDate: string | null;
  profitFirstAllocated: boolean;
  userId: number;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Income category as returned by the API. */
export interface IncomeCategory {
  id: number;
  name: string;
  system: boolean;
  userId: number;
}

/** API response for paginated income list. */
export interface IncomeListResponse {
  data: {
    content: Income[];
    page: number;
    last: boolean;
  };
}

/** API response for income category list. */
export interface IncomeCategoryListResponse {
  data: IncomeCategory[];
}
