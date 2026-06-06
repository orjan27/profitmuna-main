import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { createDb } from '@app/db';
import { requireAuth } from '@/middleware/auth';
import { createWalletService } from '@/services/wallet-service';
import {
  createWalletSchema,
  updateWalletSchema,
  walletTransactionSchema,
  updateWalletTransactionSchema,
  walletTransactionQuerySchema,
  walletIdParamSchema,
  txIdParamSchema,
} from '@/schemas/wallets';
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
  zValidator('param', walletIdParamSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'validation_error', message: 'Invalid path parameter' } },
        422
      );
    }
  }),
  zValidator('json', updateWalletSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const { walletId } = c.req.valid('param');
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const svc = createWalletService(createDb(c.env.DB));
    const result = await svc.update(walletId, userId, input);
    return c.json({ data: result });
  }
);

// DELETE /:walletId — remove wallet (returns impact counts for D-16)
walletsRouter.delete(
  '/:walletId',
  zValidator('param', walletIdParamSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'validation_error', message: 'Invalid path parameter' } },
        422
      );
    }
  }),
  async (c) => {
    const { walletId } = c.req.valid('param');
    const userId = c.get('userId');
    const svc = createWalletService(createDb(c.env.DB));
    const result = await svc.remove(walletId, userId);
    return c.json({ data: result });
  }
);

// GET /:walletId — wallet detail with breakdown + paginated history (WAL-05)
walletsRouter.get(
  '/:walletId',
  zValidator('param', walletIdParamSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'validation_error', message: 'Invalid path parameter' } },
        422
      );
    }
  }),
  zValidator('query', walletTransactionQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid query params' } }, 422);
    }
  }),
  async (c) => {
    const { walletId } = c.req.valid('param');
    const params = c.req.valid('query');
    const userId = c.get('userId');
    const svc = createWalletService(createDb(c.env.DB));
    const result = await svc.getById(walletId, userId, params);
    return c.json({ data: result });
  }
);

// IMPORTANT: register restore BEFORE the generic /:txId handlers to avoid param shadowing
// PATCH /:walletId/transactions/:txId/restore — restore soft-deleted transaction
walletsRouter.patch(
  '/:walletId/transactions/:txId/restore',
  zValidator('param', txIdParamSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'validation_error', message: 'Invalid path parameter' } },
        422
      );
    }
  }),
  async (c) => {
    const { walletId, txId } = c.req.valid('param');
    const userId = c.get('userId');
    const svc = createWalletService(createDb(c.env.DB));
    const result = await svc.restoreTransaction(walletId, txId, userId);
    return c.json({ data: result });
  }
);

// POST /:walletId/transactions — create manual transaction (WAL-04)
walletsRouter.post(
  '/:walletId/transactions',
  zValidator('param', walletIdParamSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'validation_error', message: 'Invalid path parameter' } },
        422
      );
    }
  }),
  zValidator('json', walletTransactionSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const { walletId } = c.req.valid('param');
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const svc = createWalletService(createDb(c.env.DB));
    const result = await svc.createTransaction(walletId, userId, input);
    return c.json({ data: result }, 201);
  }
);

// PUT /:walletId/transactions/:txId — update manual transaction
walletsRouter.put(
  '/:walletId/transactions/:txId',
  zValidator('param', txIdParamSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'validation_error', message: 'Invalid path parameter' } },
        422
      );
    }
  }),
  zValidator('json', updateWalletTransactionSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const { walletId, txId } = c.req.valid('param');
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const svc = createWalletService(createDb(c.env.DB));
    const result = await svc.updateTransaction(walletId, txId, userId, input);
    return c.json({ data: result });
  }
);

// DELETE /:walletId/transactions/:txId — soft-delete manual transaction
walletsRouter.delete(
  '/:walletId/transactions/:txId',
  zValidator('param', txIdParamSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'validation_error', message: 'Invalid path parameter' } },
        422
      );
    }
  }),
  async (c) => {
    const { walletId, txId } = c.req.valid('param');
    const userId = c.get('userId');
    const svc = createWalletService(createDb(c.env.DB));
    const result = await svc.removeTransaction(walletId, txId, userId);
    return c.json({ data: result });
  }
);

export { walletsRouter };
