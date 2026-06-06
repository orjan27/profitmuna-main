import { HTTPException } from 'hono/http-exception';
import { eq, and, desc, like, or, sql } from 'drizzle-orm';
import { format } from 'date-fns';

import { createDb } from '@app/db';
import { incomes, incomeCategories } from '@app/db/schema';

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateIncomeInput {
  categoryId: number;
  amount: number;
  description?: string | null;
  incomeDate: string;
  moneyStatus: 'RECEIVED' | 'PENDING';
  expectedReleaseDate?: string | null;
  profitFirstAllocated?: boolean;
}

export interface UpdateIncomeInput {
  categoryId?: number;
  amount?: number;
  description?: string | null;
  incomeDate?: string;
  moneyStatus?: 'RECEIVED' | 'PENDING';
  expectedReleaseDate?: string | null;
  profitFirstAllocated?: boolean;
}

export interface IncomeListParams {
  page: number;
  limit: number;
  search?: string;
  moneyStatus?: 'RECEIVED' | 'PENDING';
  from?: string;
  to?: string;
}

// ─── Response type ────────────────────────────────────────────────────────────

export interface IncomeRecord {
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

function toRecord(row: typeof incomes.$inferSelect): IncomeRecord {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    amount: row.amount,
    description: row.description ?? null,
    incomeDate: row.incomeDate,
    moneyStatus: row.moneyStatus as 'RECEIVED' | 'PENDING',
    expectedReleaseDate: row.expectedReleaseDate ?? null,
    receivedDate: row.receivedDate ?? null,
    profitFirstAllocated: !!row.profitFirstAllocated,
    userId: row.userId,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

// ─── Service factory ──────────────────────────────────────────────────────────

/**
 * Factory returning the income CRUD service scoped to a Drizzle db instance.
 * All queries include `eq(incomes.userId, userId)` to prevent IDOR (T-02-05).
 */
export function createIncomeService(db: ReturnType<typeof createDb>) {
  return {
    /**
     * INC-02: Paginated list with optional search, status, and date filters.
     */
    async list(
      userId: number,
      params: IncomeListParams
    ): Promise<{ content: IncomeRecord[]; page: number; last: boolean }> {
      const { page, limit, search, moneyStatus, from, to } = params;

      const conditions = [eq(incomes.userId, userId)];

      if (moneyStatus) {
        conditions.push(eq(incomes.moneyStatus, moneyStatus));
      }
      if (search) {
        const pattern = `%${search}%`;
        conditions.push(
          or(like(incomes.categoryName, pattern), like(incomes.description, pattern))!
        );
      }
      if (from) {
        conditions.push(sql`${incomes.incomeDate} >= ${from}`);
      }
      if (to) {
        conditions.push(sql`${incomes.incomeDate} <= ${to}`);
      }

      const where = and(...conditions);
      const offset = page * limit;

      const [countRows, rows] = await Promise.all([
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(incomes)
          .where(where),
        db
          .select()
          .from(incomes)
          .where(where)
          .orderBy(desc(incomes.incomeDate), desc(incomes.createdAt))
          .limit(limit)
          .offset(offset),
      ]);

      const total = Number(countRows[0]?.count ?? 0);
      const content = rows.map(toRecord);
      const last = offset + content.length >= total;

      return { content, page, last };
    },

    /**
     * INC-01: Create a new income record. Category ownership validated (T-02-07).
     */
    async create(userId: number, input: CreateIncomeInput): Promise<IncomeRecord> {
      // Validate category belongs to this user (T-02-07)
      const category = await db.query.incomeCategories.findFirst({
        where: and(eq(incomeCategories.id, input.categoryId), eq(incomeCategories.userId, userId)),
      });

      if (!category) {
        throw new HTTPException(400, { message: 'invalid_category' });
      }

      const [inserted] = await db
        .insert(incomes)
        .values({
          categoryId: input.categoryId,
          categoryName: category.name,
          amount: input.amount, // already integer cents from web layer
          description: input.description ?? null,
          incomeDate: input.incomeDate,
          moneyStatus: input.moneyStatus,
          expectedReleaseDate: input.expectedReleaseDate ?? null,
          receivedDate: input.moneyStatus === 'RECEIVED' ? input.incomeDate : null,
          profitFirstAllocated: input.profitFirstAllocated ?? true,
          userId,
        })
        .returning();

      return toRecord(inserted!);
    },

    /**
     * Fetch a single income record by id, scoped to userId. Returns 404 if not found.
     */
    async getById(id: number, userId: number): Promise<IncomeRecord> {
      const row = await db.query.incomes.findFirst({
        where: and(eq(incomes.id, id), eq(incomes.userId, userId)),
      });

      if (!row) {
        throw new HTTPException(404, { message: 'not_found' });
      }

      return toRecord(row);
    },

    /**
     * INC-03: Partial update. Re-resolves categoryName if categoryId changes.
     */
    async update(id: number, userId: number, input: UpdateIncomeInput): Promise<IncomeRecord> {
      const existing = await db.query.incomes.findFirst({
        where: and(eq(incomes.id, id), eq(incomes.userId, userId)),
      });

      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }

      let categoryName = existing.categoryName;
      if (input.categoryId !== undefined && input.categoryId !== existing.categoryId) {
        const category = await db.query.incomeCategories.findFirst({
          where: and(
            eq(incomeCategories.id, input.categoryId),
            eq(incomeCategories.userId, userId)
          ),
        });
        if (!category) {
          throw new HTTPException(400, { message: 'invalid_category' });
        }
        categoryName = category.name;
      } else if (input.categoryId !== undefined) {
        // categoryId unchanged — re-resolve name from same category (validate still owned)
        const category = await db.query.incomeCategories.findFirst({
          where: and(
            eq(incomeCategories.id, input.categoryId),
            eq(incomeCategories.userId, userId)
          ),
        });
        if (!category) {
          throw new HTTPException(400, { message: 'invalid_category' });
        }
        categoryName = category.name;
      }

      const newStatus = input.moneyStatus ?? existing.moneyStatus;
      const oldStatus = existing.moneyStatus;

      // Derive receivedDate from status transitions
      let receivedDate = existing.receivedDate;
      if (newStatus === 'RECEIVED' && oldStatus === 'PENDING') {
        receivedDate = format(new Date(), 'yyyy-MM-dd');
      } else if (newStatus === 'PENDING' && oldStatus === 'RECEIVED') {
        receivedDate = null;
      }

      const updateValues: Partial<typeof incomes.$inferInsert> = {
        ...(input.categoryId !== undefined && { categoryId: input.categoryId, categoryName }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.incomeDate !== undefined && { incomeDate: input.incomeDate }),
        ...(input.moneyStatus !== undefined && { moneyStatus: input.moneyStatus }),
        ...(input.expectedReleaseDate !== undefined && {
          expectedReleaseDate: input.expectedReleaseDate,
        }),
        ...(input.profitFirstAllocated !== undefined && {
          profitFirstAllocated: input.profitFirstAllocated,
        }),
        receivedDate,
      };

      const [updated] = await db
        .update(incomes)
        .set(updateValues)
        .where(and(eq(incomes.id, id), eq(incomes.userId, userId)))
        .returning();

      return toRecord(updated!);
    },

    /**
     * INC-05: Mark income as received. Does NOT modify profitFirstAllocated (T-02-08).
     * Uses provided receivedDate or defaults to today.
     */
    async receive(id: number, userId: number, receivedDate?: string): Promise<IncomeRecord> {
      const existing = await db.query.incomes.findFirst({
        where: and(eq(incomes.id, id), eq(incomes.userId, userId)),
      });

      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }

      const date = receivedDate ?? format(new Date(), 'yyyy-MM-dd');

      // T-02-08: Only set moneyStatus + receivedDate — never touch profitFirstAllocated
      const [updated] = await db
        .update(incomes)
        .set({ moneyStatus: 'RECEIVED', receivedDate: date })
        .where(and(eq(incomes.id, id), eq(incomes.userId, userId)))
        .returning();

      return toRecord(updated!);
    },

    /**
     * INC-04: Hard-delete the owned income row.
     */
    async delete(id: number, userId: number): Promise<void> {
      const existing = await db.query.incomes.findFirst({
        where: and(eq(incomes.id, id), eq(incomes.userId, userId)),
      });

      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }

      await db.delete(incomes).where(and(eq(incomes.id, id), eq(incomes.userId, userId)));
    },
  };
}
