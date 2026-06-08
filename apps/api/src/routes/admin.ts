import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { createDb } from '@app/db';
import { createAdminService } from '@/services/admin-service';
import { runCron } from '@/services/cron-service';
import { updateUserRoleSchema } from '@/schemas/admin';
import { idParamSchema } from '@/schemas/common';
import type { Bindings, Variables } from '@/types';

const adminRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// security.md: validation failures return 422 (zValidator defaults to 400),
// hence the explicit hook on every zValidator below.

/** Validation hook: returns 422 on param/body schema failure (security.md). */
function paramValidationHook(result: { success: boolean }, c: Context) {
  if (!result.success) {
    return c.json({ error: { code: 'validation_error', message: 'Invalid id param' } }, 422);
  }
}

// GET /users — all users (display fields only)
adminRouter.get('/users', async (c) => {
  const svc = createAdminService(createDb(c.env.DB));
  const result = await svc.listUsers();
  return c.json({ data: result });
});

// PUT /users/:id/role — change a user's role (never your own)
adminRouter.put(
  '/users/:id/role',
  zValidator('param', idParamSchema, paramValidationHook),
  zValidator('json', updateUserRoleSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const { role } = c.req.valid('json');
    const actingUserId = c.get('userId');
    const svc = createAdminService(createDb(c.env.DB));
    const result = await svc.updateUserRole(id, role, actingUserId);
    return c.json({ data: result });
  }
);

// GET /cron/last-run — latest hourly-cron run for the Scheduled Jobs display
adminRouter.get('/cron/last-run', async (c) => {
  const svc = createAdminService(createDb(c.env.DB));
  const result = await svc.getLastCronRun();
  return c.json({ data: result });
});

// POST /cron/run — manual trigger: recurring generation + due-income bells for
// all users. Reminder emails are skipped (not idempotent — see CronRunOptions).
adminRouter.post('/cron/run', async (c) => {
  const result = await runCron(c.env, undefined, {
    trigger: 'MANUAL',
    includeReminders: false,
  });
  return c.json({ data: result });
});

export { adminRouter };
