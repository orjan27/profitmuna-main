import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';

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
  login,
  refreshTokens,
  logout,
} from '@/services/auth-service';
import { requireAuth } from '@/middleware/auth';
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
    const result = await login(c.env.DB, c.env.JWT_ACCESS_SECRET, email, password);
    const isProduction = c.env.NODE_ENV === 'production';
    setCookie(c, 'access_token', result.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'Lax',
      path: '/',
      maxAge: 1800, // 30 minutes
    });
    setCookie(c, 'refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'Lax',
      path: '/',
      maxAge: 604800, // 7 days
    });
    return c.json({ data: { userId: result.userId } });
  }
);

authRouter.post('/refresh', async (c) => {
  const rawRefreshToken = getCookie(c, 'refresh_token');
  if (!rawRefreshToken) {
    return c.json({ error: { code: 'unauthorized', message: 'No refresh token' } }, 401);
  }
  const result = await refreshTokens(c.env.DB, c.env.JWT_ACCESS_SECRET, rawRefreshToken);
  const isProduction = c.env.NODE_ENV === 'production';
  setCookie(c, 'access_token', result.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax',
    path: '/',
    maxAge: 1800,
  });
  setCookie(c, 'refresh_token', result.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax',
    path: '/',
    maxAge: 604800,
  });
  return c.json({ data: { userId: result.userId } });
});

// requireAuth applied only to /logout (and future protected routes — not globally)
authRouter.use('/logout', requireAuth);
authRouter.post('/logout', async (c) => {
  const userId = c.get('userId');
  await logout(c.env.DB, userId);
  deleteCookie(c, 'access_token', { path: '/' });
  deleteCookie(c, 'refresh_token', { path: '/' });
  return c.json({ data: { message: 'logged_out' } });
});

export { authRouter };
