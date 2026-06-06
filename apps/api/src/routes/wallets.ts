import { Hono } from 'hono';

import { requireAuth } from '@/middleware/auth';
import type { Bindings, Variables } from '@/types';

// Stub router — route handlers are filled in Plans 02 and 03.
// requireAuth at router level guards every /api/wallets/* endpoint (T-04-01).
const walletsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

walletsRouter.use('/*', requireAuth);

export { walletsRouter };
