import { z } from 'zod';

/** Query params for GET /api/notifications — coerces string query values from URL. */
export const notificationQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(50).optional().default(50),
});
