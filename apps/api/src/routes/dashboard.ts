import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { requireAuth } from '@/middleware/auth';
import { createDashboardService } from '@/services/dashboard-service';
import { dashboardQuerySchema } from '@/schemas/dashboard';
import { createDb } from '@app/db';
import type { Bindings, Variables } from '@/types';

const dashboardRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// T-05-01: every route behind requireAuth — no unauthenticated access to aggregates
dashboardRouter.use('/*', requireAuth);

// GET /summary — full dashboard aggregate with optional date range + feed pagination
dashboardRouter.get(
  '/summary',
  zValidator('query', dashboardQuerySchema, (result, c) => {
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
    const svc = createDashboardService(db);
    const userId = c.get('userId');

    const dateRange = query.from || query.to ? { from: query.from, to: query.to } : undefined;

    const result = await svc.getSummary(userId, dateRange, query.feedPage, query.feedSize);
    return c.json({ data: result });
  }
);

export { dashboardRouter };
