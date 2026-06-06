import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { createDb } from '@app/db';
import { createExpenseCategoryService } from '@/services/expense-category-service';
import { createExpenseCategorySchema, updateExpenseCategorySchema } from '@/schemas/expense';
import { idParamSchema } from '@/schemas/common';
import type { Bindings, Variables } from '@/types';

const expenseCategoriesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/** GET / — list categories for the authenticated user (seeds defaults on first access). */
expenseCategoriesRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const svc = createExpenseCategoryService(createDb(c.env.DB));
  const data = await svc.list(userId);
  return c.json({ data });
});

/** POST / — create a custom expense category. */
expenseCategoriesRouter.post(
  '/',
  zValidator('json', createExpenseCategorySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const { name } = c.req.valid('json');
    const userId = c.get('userId');
    const svc = createExpenseCategoryService(createDb(c.env.DB));
    const data = await svc.create(userId, name);
    return c.json({ data }, 201);
  }
);

/** PUT /:id — rename a custom expense category (cascades to existing records). */
expenseCategoriesRouter.put(
  '/:id',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid id param' } }, 422);
    }
  }),
  zValidator('json', updateExpenseCategorySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const { name } = c.req.valid('json');
    const userId = c.get('userId');
    const svc = createExpenseCategoryService(createDb(c.env.DB));
    const data = await svc.update(id, userId, name);
    return c.json({ data });
  }
);

/** DELETE /:id — delete a custom expense category (blocked if in use). */
expenseCategoriesRouter.delete(
  '/:id',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid id param' } }, 422);
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const userId = c.get('userId');
    const svc = createExpenseCategoryService(createDb(c.env.DB));
    await svc.delete(id, userId);
    return c.json({ data: { message: 'deleted' } });
  }
);

export { expenseCategoriesRouter };
