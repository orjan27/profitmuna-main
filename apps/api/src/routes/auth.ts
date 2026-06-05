import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { createEmailService } from '@/lib/email';
import {
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  loginSchema,
} from '@/schemas/auth';
import {
  register,
  verifyEmail,
  resendVerification,
  assertLoginAllowed,
} from '@/services/auth-service';
import type { Bindings, Variables } from '@/types';

const authRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// security.md: validation failures return 422 (zValidator defaults to 400),
// hence the explicit hook on every zValidator below.
authRouter.post(
  '/register',
  zValidator('json', registerSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const input = c.req.valid('json');
    const result = await register(c.env.DB, c.env.APP_BASE_URL, input);
    if (result) {
      const emailSvc = createEmailService(c.env.RESEND_API_KEY, c.env.RESEND_FROM_EMAIL);
      c.executionCtx.waitUntil(emailSvc.sendVerificationEmail(result.email, result.verifyUrl));
      c.executionCtx.waitUntil(emailSvc.sendWelcomeEmail(result.email, result.name));
    }
    // Generic shape regardless of prior existence (enumeration mitigation)
    return c.json({ data: { message: 'registration_received' } }, 201);
  }
);

authRouter.post(
  '/verify-email',
  zValidator('json', verifyEmailSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const { token } = c.req.valid('json');
    await verifyEmail(c.env.DB, token);
    return c.json({ data: { message: 'email_verified' } });
  }
);

authRouter.post(
  '/resend-verification',
  zValidator('json', resendVerificationSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const { email } = c.req.valid('json');
    const result = await resendVerification(c.env.DB, c.env.APP_BASE_URL, email);
    if (result) {
      const emailSvc = createEmailService(c.env.RESEND_API_KEY, c.env.RESEND_FROM_EMAIL);
      c.executionCtx.waitUntil(emailSvc.sendVerificationEmail(result.email, result.verifyUrl));
    }
    // Generic shape regardless of account existence (enumeration mitigation)
    return c.json({ data: { message: 'verification_sent' } });
  }
);

authRouter.post(
  '/login',
  zValidator('json', loginSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const { email, password } = c.req.valid('json');
    // This slice only enforces the verification gate (D-07) — 401/403 propagate.
    // Session issuance (cookies, refresh rotation) lands in slice 01-02.
    await assertLoginAllowed(c.env.DB, email, password);
    return c.json(
      { error: { code: 'not_implemented', message: 'Login session issuance arrives in slice 02' } },
      501
    );
  }
);

export { authRouter };
