import { NextRequest, NextResponse } from 'next/server';

import {
  extractTokenFromSetCookie,
  isTokenNearExpiry,
  rewriteCookieHeader,
} from '@/lib/auth-tokens';

// Public routes — always allow through without a session.
// '/' is the marketing landing page; the rest are auth flows.
const PUBLIC_ROUTES = new Set([
  '/',
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
]);

/**
 * Auth gate + silent token refresh.
 *
 * - Neither access_token nor refresh_token cookie → redirect to /login.
 * - access_token missing or near-expiry while refresh_token is present →
 *   silently POST /api/auth/refresh server-to-server, splice the fresh
 *   access token into the request Cookie header (so getSession()/apiFetch()
 *   in this same render pass see it) and relay the rotated Set-Cookie
 *   headers to the browser.
 * - Refresh failure (401 or network error) → fail open: proceed and let the
 *   RSC's getSession() issue the terminal /login redirect. Middleware never
 *   redirects a request that still carries a refresh_token — concurrent
 *   prefetch refreshes losing the rotation race must not bounce the user.
 *
 * The matcher excludes /api/*, /_next/*, and static asset paths.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Allow public routes through unconditionally
  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;

  // If neither token is present, redirect to /login
  if (!accessToken && !refreshToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Silent refresh when the access token is missing or about to expire
  if (refreshToken && (!accessToken || isTokenNearExpiry(accessToken))) {
    const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8793';
    try {
      const refreshRes = await fetch(`${apiBaseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { Cookie: `refresh_token=${refreshToken}` },
      });
      if (refreshRes.ok) {
        const setCookies = refreshRes.headers.getSetCookie();
        const newAccessToken = extractTokenFromSetCookie(setCookies, 'access_token');
        const newRefreshToken = extractTokenFromSetCookie(setCookies, 'refresh_token');
        if (newAccessToken) {
          const updates: Record<string, string> = { access_token: newAccessToken };
          if (newRefreshToken) updates.refresh_token = newRefreshToken;

          // Rewrite the request Cookie header so the downstream RSC render of
          // THIS request reads the fresh token via cookies().
          const requestHeaders = new Headers(request.headers);
          requestHeaders.set('cookie', rewriteCookieHeader(request.headers.get('cookie'), updates));

          const response = NextResponse.next({ request: { headers: requestHeaders } });
          // Persist the rotated cookies in the browser — append() never set()
          for (const cookie of setCookies) {
            response.headers.append('Set-Cookie', cookie);
          }
          return response;
        }
      }
    } catch {
      // Network error reaching the API — fall through and let the RSC decide.
    }
  }

  return NextResponse.next();
}

export const config = {
  // Exclude: api routes, Next.js internals, static files
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
