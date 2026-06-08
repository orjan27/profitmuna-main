import { z } from 'zod';

/** Schema for changing a user's role (PUT /api/admin/users/:id/role). */
export const updateUserRoleSchema = z.object({
  role: z.enum(['ADMIN', 'USER']),
});
