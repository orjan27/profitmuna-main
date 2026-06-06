import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { createDb } from '@app/db';
import { createExpenseService } from '@/services/expense-service';
import { createExpenseSchema, updateExpenseSchema, expenseQuerySchema } from '@/schemas/expense';
import { idParamSchema } from '@/schemas/common';
import type { Bindings, Variables } from '@/types';

const expensesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/** Validation hook: returns 422 on schema failure (security.md). */
function validationHook<T>(
  result: { success: boolean },
  c: { json: (body: unknown, status: number) => Response }
) {
  if (!result.success) {
    return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
  }
}

// GET /api/expenses — list expenses with optional date-range filter + pagination
expensesRouter.get(
  '/',
  zValidator('query', expenseQuerySchema, validationHook as Parameters<typeof zValidator>[2]),
  async (c) => {
    const query = c.req.valid('query');
    const db = createDb(c.env.DB);
    const svc = createExpenseService(db);
    const result = await svc.list(c.get('userId'), {
      page: query.page,
      limit: query.limit,
      from: query.from,
      to: query.to,
    });
    return c.json(result, 200);
  }
);

// POST /api/expenses — create a new expense (201)
expensesRouter.post(
  '/',
  zValidator('json', createExpenseSchema, validationHook as Parameters<typeof zValidator>[2]),
  async (c) => {
    const body = c.req.valid('json');
    const db = createDb(c.env.DB);
    const svc = createExpenseService(db);
    const result = await svc.create(c.get('userId'), body);
    return c.json(result, 201);
  }
);

// PATCH /api/expenses/:id/restore — restore a soft-deleted expense
// MUST be registered BEFORE /:id to avoid route shadowing
expensesRouter.patch(
  '/:id/restore',
  zValidator('param', idParamSchema, validationHook as Parameters<typeof zValidator>[2]),
  async (c) => {
    const { id } = c.req.valid('param');
    const db = createDb(c.env.DB);
    const svc = createExpenseService(db);
    const result = await svc.restore(id, c.get('userId'));
    return c.json(result, 200);
  }
);

// GET /api/expenses/:id — get a single expense
expensesRouter.get(
  '/:id',
  zValidator('param', idParamSchema, validationHook as Parameters<typeof zValidator>[2]),
  async (c) => {
    const { id } = c.req.valid('param');
    const db = createDb(c.env.DB);
    const svc = createExpenseService(db);
    const result = await svc.getById(id, c.get('userId'));
    return c.json(result, 200);
  }
);

// PUT /api/expenses/:id — update an owned expense
expensesRouter.put(
  '/:id',
  zValidator('param', idParamSchema, validationHook as Parameters<typeof zValidator>[2]),
  zValidator('json', updateExpenseSchema, validationHook as Parameters<typeof zValidator>[2]),
  async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const db = createDb(c.env.DB);
    const svc = createExpenseService(db);
    const result = await svc.update(id, c.get('userId'), body);
    return c.json(result, 200);
  }
);

// DELETE /api/expenses/:id — soft-delete an expense
expensesRouter.delete(
  '/:id',
  zValidator('param', idParamSchema, validationHook as Parameters<typeof zValidator>[2]),
  async (c) => {
    const { id } = c.req.valid('param');
    const db = createDb(c.env.DB);
    const svc = createExpenseService(db);
    await svc.delete(id, c.get('userId'));
    return c.body(null, 204);
  }
);

export { expensesRouter };
