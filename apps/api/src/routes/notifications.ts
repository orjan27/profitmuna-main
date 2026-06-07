import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { createDb } from '@app/db';
import { requireAuth } from '@/middleware/auth';
import { createNotificationService } from '@/services/notification-service';
import { notificationQuerySchema } from '@/schemas/notifications';
import type { Bindings, Variables } from '@/types';

const notificationsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// requireAuth at router level guards every /api/notifications/* endpoint (T-6-07)
notificationsRouter.use('/*', requireAuth);

// GET / — list notifications (newest-first, optional unreadOnly filter, max 50)
notificationsRouter.get(
  '/',
  zValidator('query', notificationQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid query params' } }, 422);
    }
  }),
  async (c) => {
    const params = c.req.valid('query');
    const userId = c.get('userId');
    const svc = createNotificationService(c.env.DB);
    const result = await svc.list(userId, params);
    return c.json({ data: result });
  }
);

// GET /unread-count — unread notification count for the badge (T-6-07, T-6-09)
notificationsRouter.get('/unread-count', async (c) => {
  const userId = c.get('userId');
  const svc = createNotificationService(c.env.DB);
  const count = await svc.getUnreadCount(userId);
  return c.json({ data: { count } });
});

// IMPORTANT: register /read-all BEFORE /:id/read to avoid param shadowing.
// If /:id/read is registered first, Hono matches "read-all" as an :id value
// and /read-all never fires.

// PUT /read-all — mark all unread notifications as read for the user
notificationsRouter.put('/read-all', async (c) => {
  const userId = c.get('userId');
  const svc = createNotificationService(c.env.DB);
  await svc.markAllAsRead(userId);
  return c.json({ data: { success: true } });
});

// PUT /:id/read — mark a single notification as read (IDOR-safe: userId checked in service)
notificationsRouter.put('/:id/read', async (c) => {
  const id = Number(c.req.param('id'));
  const userId = c.get('userId');
  const svc = createNotificationService(c.env.DB);
  await svc.markAsRead(id, userId);
  return c.json({ data: { success: true } });
});

export { notificationsRouter };
