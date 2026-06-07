import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { requireAuth } from '@/middleware/auth';
import { createSettingsService } from '@/services/settings-service';
import { updateSettingsSchema } from '@/schemas/settings';
import type { Bindings, Variables } from '@/types';

const settingsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// T-6-03: every settings route behind requireAuth — no unauthenticated access
settingsRouter.use('/*', requireAuth);

// GET / — returns the caller's current settings
settingsRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const svc = createSettingsService(c.env);
  const settings = await svc.getSettings(userId);
  return c.json({ data: settings });
});

// PUT / — updates the caller's settings; zValidator rejects invalid currency/schedule values
settingsRouter.put(
  '/',
  zValidator('json', updateSettingsSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const svc = createSettingsService(c.env);
    const settings = await svc.updateSettings(userId, input);
    return c.json({ data: settings });
  }
);

export { settingsRouter };
