import { NextRequest, NextResponse } from 'next/server';

// Public auth routes — always allow through without a session
const AUTH_ROUTES = new Set([
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
]);

/**
 * Redirects unauthenticated requests to /login.
 *
 * An unauthenticated request is one that has neither an access_token nor a
 * refresh_token cookie — the BFF will handle silent refresh if only the
 * access token is missing but the refresh token is present.
 *
 * The matcher excludes /api/*, /_next/*, and static asset paths.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Allow auth routes through unconditionally
  if (AUTH_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;

  // If neither token is present, redirect to /login
  if (!accessToken && !refreshToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Exclude: api routes, Next.js internals, static files
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
