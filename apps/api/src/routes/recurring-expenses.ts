import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { createDb } from '@app/db';
import { createRecurringExpenseService } from '@/services/recurring-expense-service';
import { createRecurringExpenseSchema, updateRecurringExpenseSchema } from '@/schemas/recurring';
import { idParamSchema } from '@/schemas/common';
import type { Bindings, Variables } from '@/types';

const recurringExpensesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// security.md: validation failures return 422 (zValidator defaults to 400),
// hence the explicit hook on every zValidator below.

/** Validation hook: returns 422 on param/body schema failure (security.md). */
function paramValidationHook(result: { success: boolean }, c: Context) {
  if (!result.success) {
    return c.json({ error: { code: 'validation_error', message: 'Invalid id param' } }, 422);
  }
}

// GET / — all recurring expense templates for the user
recurringExpensesRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const svc = createRecurringExpenseService(createDb(c.env.DB));
  const result = await svc.list(userId);
  return c.json({ data: result });
});

// POST / — create a recurring expense template
recurringExpensesRouter.post(
  '/',
  zValidator('json', createRecurringExpenseSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const svc = createRecurringExpenseService(createDb(c.env.DB));
    const result = await svc.create(userId, input);
    return c.json({ data: result }, 201);
  }
);

// PUT /:id — update a recurring expense template (incl. active pause/resume)
recurringExpensesRouter.put(
  '/:id',
  zValidator('param', idParamSchema, paramValidationHook),
  zValidator('json', updateRecurringExpenseSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const svc = createRecurringExpenseService(createDb(c.env.DB));
    const result = await svc.update(id, userId, input);
    return c.json({ data: result });
  }
);

// DELETE /:id — stop (hard-delete) a recurring expense template
recurringExpensesRouter.delete(
  '/:id',
  zValidator('param', idParamSchema, paramValidationHook),
  async (c) => {
    const { id } = c.req.valid('param');
    const userId = c.get('userId');
    const svc = createRecurringExpenseService(createDb(c.env.DB));
    await svc.delete(id, userId);
    return c.body(null, 204);
  }
);

export { recurringExpensesRouter };
