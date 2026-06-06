import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { createDb } from '@app/db';
import { createIncomeService } from '@/services/income-service';
import {
  incomeQuerySchema,
  createIncomeSchema,
  updateIncomeSchema,
  receiveIncomeSchema,
} from '@/schemas/income';
import type { Bindings, Variables } from '@/types';

const incomesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// security.md: validation failures return 422 (zValidator defaults to 400),
// hence the explicit hook on every zValidator below.

// GET / — paginated list with filters
incomesRouter.get(
  '/',
  zValidator('query', incomeQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid query params' } }, 422);
    }
  }),
  async (c) => {
    const params = c.req.valid('query');
    const userId = c.get('userId');
    const svc = createIncomeService(createDb(c.env.DB));
    const result = await svc.list(userId, params);
    return c.json({ data: result });
  }
);

// POST / — create income
incomesRouter.post(
  '/',
  zValidator('json', createIncomeSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const svc = createIncomeService(createDb(c.env.DB));
    const result = await svc.create(userId, input);
    return c.json({ data: result }, 201);
  }
);

// PUT /:id/receive — MUST be registered before /:id to avoid param shadowing
incomesRouter.put(
  '/:id/receive',
  zValidator('json', receiveIncomeSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const id = Number(c.req.param('id'));
    const { receivedDate } = c.req.valid('json');
    const userId = c.get('userId');
    const svc = createIncomeService(createDb(c.env.DB));
    const result = await svc.receive(id, userId, receivedDate);
    return c.json({ data: result });
  }
);

// GET /:id — fetch single income
incomesRouter.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const userId = c.get('userId');
  const svc = createIncomeService(createDb(c.env.DB));
  const result = await svc.getById(id, userId);
  return c.json({ data: result });
});

// PUT /:id — update income
incomesRouter.put(
  '/:id',
  zValidator('json', updateIncomeSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const id = Number(c.req.param('id'));
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const svc = createIncomeService(createDb(c.env.DB));
    const result = await svc.update(id, userId, input);
    return c.json({ data: result });
  }
);

// DELETE /:id — hard-delete income
incomesRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const userId = c.get('userId');
  const svc = createIncomeService(createDb(c.env.DB));
  await svc.delete(id, userId);
  return c.body(null, 204);
});

export { incomesRouter };
