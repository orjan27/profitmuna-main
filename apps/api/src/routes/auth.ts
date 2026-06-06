import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import * as arctic from 'arctic';

import { createEmailService } from '@/lib/email';
import {
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  googleUserinfoSchema,
} from '@/schemas/auth';
import {
  register,
  verifyEmail,
  resendVerification,
  login,
  refreshTokens,
  logout,
  forgotPassword,
  resetPassword,
  upsertGoogleUser,
} from '@/services/auth-service';
import { createDb } from '@app/db';
import { refreshTokens as refreshTokensTable } from '@app/db/schema';
import { signAccessToken } from '@/lib/jwt';
import { generateSecureToken, sha256Hash } from '@/lib/token';
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

// POST /forgot-password — always returns the same generic body (enumeration mitigation T-03-02)
authRouter.post(
  '/forgot-password',
  zValidator('json', forgotPasswordSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const { email } = c.req.valid('json');
    const result = await forgotPassword(c.env.DB, c.env.APP_BASE_URL, email);
    // Email only when user actually exists — never reveal existence in response body (T-03-02)
    if (result.exists && result.resetUrl) {
      const emailSvc = createEmailService(c.env.RESEND_API_KEY, c.env.RESEND_FROM_EMAIL);
      c.executionCtx.waitUntil(emailSvc.sendPasswordResetEmail(email, result.resetUrl));
    }
    // Generic response regardless of account existence
    return c.json({ data: { message: 'reset_requested' } });
  }
);

// POST /reset-password — redeems token and sets a new password; 400 propagates from service
authRouter.post(
  '/reset-password',
  zValidator('json', resetPasswordSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const { token, password } = c.req.valid('json');
    await resetPassword(c.env.DB, token, password);
    return c.json({ data: { message: 'password_reset' } });
  }
);

/** Refresh token lifetime in seconds (7 days) */
const REFRESH_TOKEN_TTL_S = 7 * 24 * 60 * 60;
/** Access token lifetime in seconds (30 minutes) */
const ACCESS_TOKEN_TTL_S = 30 * 60;

// GET /google — initiate Google OAuth PKCE flow
authRouter.get('/google', (c) => {
  const google = new arctic.Google(
    c.env.GOOGLE_CLIENT_ID,
    c.env.GOOGLE_CLIENT_SECRET,
    c.env.GOOGLE_REDIRECT_URI
  );
  const state = arctic.generateState();
  const codeVerifier = arctic.generateCodeVerifier();
  const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']);

  const isProduction = c.env.NODE_ENV === 'production';
  // SameSite=Lax — must survive the cross-site OAuth redirect (Pitfall 6 / T-04-01)
  setCookie(c, 'oauth_state', state, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 600,
    secure: isProduction,
  });
  setCookie(c, 'oauth_code_verifier', codeVerifier, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 600,
    secure: isProduction,
  });

  return c.redirect(url.toString());
});

// GET /google/callback — exchange code, upsert user, issue session
authRouter.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const storedState = getCookie(c, 'oauth_state');
  const storedVerifier = getCookie(c, 'oauth_code_verifier');

  // T-04-01 CSRF guard: reject missing/mismatched state or missing verifier
  if (!code || !state || state !== storedState || !storedVerifier) {
    throw new HTTPException(400, { message: 'invalid_oauth_state' });
  }

  // T-04-04 PKCE: validate code with stored verifier
  const google = new arctic.Google(
    c.env.GOOGLE_CLIENT_ID,
    c.env.GOOGLE_CLIENT_SECRET,
    c.env.GOOGLE_REDIRECT_URI
  );
  const tokens = await google.validateAuthorizationCode(code, storedVerifier);
  const accessToken = tokens.accessToken();

  // Fetch userinfo from Google (server-to-server — token never stored, T-04-05)
  const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // A non-200 (revoked token, rate limit) must not be parsed as a user (CR-01)
  if (!userRes.ok) {
    throw new HTTPException(400, { message: 'oauth_userinfo_failed' });
  }
  // Narrow the untrusted external payload at the boundary (CR-01 / WR-05).
  // A malformed body throws via Zod rather than leaking undefined fields.
  const googleUser = googleUserinfoSchema.parse(await userRes.json());
  // Email is only an identity key when the provider asserts it is verified —
  // otherwise an unverified Google identity could hijack a local account (CR-01).
  if (!googleUser.email_verified) {
    throw new HTTPException(400, { message: 'email_not_verified' });
  }

  // Upsert user (T-04-03 account-linking: email is the identity key)
  const userId = await upsertGoogleUser(c.env.DB, {
    sub: googleUser.sub,
    email: googleUser.email,
    name: googleUser.name,
  });

  // Issue the same httpOnly session as password login (sign access JWT + insert refresh token row)
  const jwtAccessToken = await signAccessToken(userId, c.env.JWT_ACCESS_SECRET);
  const rawRefreshToken = generateSecureToken();
  const db = createDb(c.env.DB);
  await db.insert(refreshTokensTable).values({
    userId,
    tokenHash: await sha256Hash(rawRefreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_S * 1000).toISOString(),
  });

  const isProduction = c.env.NODE_ENV === 'production';
  setCookie(c, 'access_token', jwtAccessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_S,
  });
  setCookie(c, 'refresh_token', rawRefreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_S,
  });

  // Clear state and verifier cookies (consumed once)
  deleteCookie(c, 'oauth_state', { path: '/' });
  deleteCookie(c, 'oauth_code_verifier', { path: '/' });

  // T-04-02 open-redirect guard: always redirect to fixed internal path, never a user-supplied URL
  return c.redirect(`${c.env.APP_BASE_URL}/`);
});

export { authRouter };
