import { Hono } from 'hono';

import type { Bindings, Variables } from '@/types';

// Stub router — handlers will be filled in during Plan 03.
// All routes in this group are mounted behind requireAuth in index.ts.
const expenseCategoriesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

export { expenseCategoriesRouter };
