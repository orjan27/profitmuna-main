import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { createDb } from '@app/db';
import { requireAuth } from '@/middleware/auth';
import { createWalletService } from '@/services/wallet-service';
import { createWalletSchema, updateWalletSchema } from '@/schemas/wallets';
import type { Bindings, Variables } from '@/types';

const walletsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// requireAuth at router level guards every /api/wallets/* endpoint (T-04-01)
walletsRouter.use('/*', requireAuth);

// GET / — list wallets with computed balances
walletsRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const svc = createWalletService(createDb(c.env.DB));
  const result = await svc.list(userId);
  return c.json({ data: result });
});

// POST / — create wallet
walletsRouter.post(
  '/',
  zValidator('json', createWalletSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const svc = createWalletService(createDb(c.env.DB));
    const result = await svc.create(userId, input);
    return c.json({ data: result }, 201);
  }
);

// PUT /:walletId — update wallet
walletsRouter.put(
  '/:walletId',
  zValidator('json', updateWalletSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const walletId = Number(c.req.param('walletId'));
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const svc = createWalletService(createDb(c.env.DB));
    const result = await svc.update(walletId, userId, input);
    return c.json({ data: result });
  }
);

// DELETE /:walletId — remove wallet (returns impact counts for D-16)
walletsRouter.delete('/:walletId', async (c) => {
  const walletId = Number(c.req.param('walletId'));
  const userId = c.get('userId');
  const svc = createWalletService(createDb(c.env.DB));
  const result = await svc.remove(walletId, userId);
  return c.json({ data: result });
});

export { walletsRouter };
