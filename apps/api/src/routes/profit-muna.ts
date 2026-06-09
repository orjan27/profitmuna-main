import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { requireAuth } from '@/middleware/auth';
import { createProfitMunaService } from '@/services/profit-muna-service';
import {
  createAccountSchema,
  updateAccountSchema,
  updatePercentagesSchema,
  summaryQuerySchema,
} from '@/schemas/profit-muna';
import { createDb } from '@app/db';
import type { Bindings, Variables } from '@/types';

const profitMunaRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// T-03-09: every route behind requireAuth — no unauthenticated access to PF endpoints
profitMunaRouter.use('/*', requireAuth);

// GET /summary — allocation summary with optional date range + category filters
profitMunaRouter.get(
  '/summary',
  zValidator('query', summaryQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'validation_error', message: 'Invalid query parameters' } },
        422
      );
    }
  }),
  async (c) => {
    const query = c.req.valid('query');
    const db = createDb(c.env.DB);
    const svc = createProfitMunaService(db);
    const userId = c.get('userId');

    // Parse comma-separated categoryIds to number[]
    const categoryIds =
      query.categoryIds
        ?.split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n)) ?? undefined;

    const dateRange = query.from || query.to ? { from: query.from, to: query.to } : undefined;

    const result = await svc.getSummary(
      userId,
      dateRange,
      categoryIds ? { categoryIds } : undefined
    );
    return c.json({ data: result });
  }
);

// POST /accounts — create a new custom allocation account
profitMunaRouter.post(
  '/accounts',
  zValidator('json', createAccountSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const input = c.req.valid('json');
    const db = createDb(c.env.DB);
    const svc = createProfitMunaService(db);
    const userId = c.get('userId');

    const account = await svc.createAccount(userId, input);
    return c.json({ data: account }, 201);
  }
);

// PATCH /accounts/:id — partial update of a custom or default account
profitMunaRouter.patch(
  '/accounts/:id',
  zValidator('json', updateAccountSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const input = c.req.valid('json');
    const db = createDb(c.env.DB);
    const svc = createProfitMunaService(db);
    const userId = c.get('userId');

    const accountId = parseInt(c.req.param('id'), 10);
    if (isNaN(accountId)) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid account id' } }, 422);
    }

    const account = await svc.updateAccount(accountId, userId, input);
    return c.json({ data: account });
  }
);

// DELETE /accounts/:id — delete a CUSTOM allocation account
profitMunaRouter.delete('/accounts/:id', async (c) => {
  const db = createDb(c.env.DB);
  const svc = createProfitMunaService(db);
  const userId = c.get('userId');

  const accountId = parseInt(c.req.param('id'), 10);
  if (isNaN(accountId)) {
    return c.json({ error: { code: 'validation_error', message: 'Invalid account id' } }, 422);
  }

  await svc.deleteAccount(accountId, userId);
  return c.json({ data: null });
});

// PUT /percentages — bulk update of targetPercentage; must sum to exactly 10000 bp
profitMunaRouter.put(
  '/percentages',
  zValidator('json', updatePercentagesSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const input = c.req.valid('json');
    const db = createDb(c.env.DB);
    const svc = createProfitMunaService(db);
    const userId = c.get('userId');

    const accounts = await svc.updatePercentages(userId, input);
    return c.json({ data: accounts });
  }
);

export { profitMunaRouter };
