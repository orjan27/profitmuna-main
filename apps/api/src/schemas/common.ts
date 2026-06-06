import { z } from 'zod';

/** Shared pagination parameters for list endpoints. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Pagination with optional ISO date range filters (YYYY-MM-DD). */
export const paginationWithDateSchema = paginationSchema.extend({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/** Path parameter schema for /:id routes. */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
