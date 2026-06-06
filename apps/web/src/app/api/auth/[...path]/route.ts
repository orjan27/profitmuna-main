import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// BFF catch-all proxy (D-01): the browser only ever calls this same-origin route;
// we forward server-to-server to the Workers API and relay Set-Cookie headers.
// Transparent-refresh logic (slice 01-02): if the access token is near-expiry,
// we silently POST /api/auth/refresh before forwarding the original request so the
// browser never sees a 401. RESEARCH.md Pattern 1, Pitfalls 2/3.

// Unauthenticated endpoints — skip transparent refresh for these paths
const UNAUTHED_PATHS = new Set([
  'login',
  'register',
  'verify-email',
  'forgot-password',
  'reset-password',
  'resend-verification',
  'refresh',
]);

/**
 * Decodes the JWT exp claim without verifying the signature.
 * Verification is the API's responsibility — this is purely for near-expiry detection.
 * Returns true if the token is expiring within 60 seconds or the claim is absent/unreadable.
 */
export function isTokenNearExpiry(jwt: string): boolean {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return true;
    // base64url → base64 → parse
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
    ) as { exp?: number };
    if (typeof payload.exp !== 'number') return true;
    // Near-expiry window: 60 seconds
    return payload.exp - Math.floor(Date.now() / 1000) < 60;
  } catch {
    return true;
  }
}

/**
 * Extracts a cookie value from a Set-Cookie array.
 */
function extractTokenFromSetCookie(setCookies: string[], name: string): string | undefined {
  for (const header of setCookies) {
    const [nameValue] = header.split(';');
    const [cookieName, ...valueParts] = nameValue.split('=');
    if (cookieName.trim() === name) {
      return valueParts.join('=').trim();
    }
  }
  return undefined;
}

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  // Server-only env — intentionally NOT NEXT_PUBLIC_
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8793';

  // cookies() is async in Next.js 15
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  const refreshToken = cookieStore.get('refresh_token')?.value;

  const endpoint = path[path.length - 1];
  const isUnauthenticated = UNAUTHED_PATHS.has(endpoint ?? '');

  let token = accessToken;
  let prefetchedCookies: string[] = [];

  // Transparent refresh: if access token is near-expiry and we have a refresh token,
  // do a server-to-server refresh call before forwarding the original request.
  // Skip for unauthenticated endpoints (login/register/etc).
  if (!isUnauthenticated && refreshToken && (!token || isTokenNearExpiry(token))) {
    const refreshRes = await fetch(`${apiBaseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `refresh_token=${refreshToken}` },
    });
    if (refreshRes.ok) {
      const setCookies = refreshRes.headers.getSetCookie();
      prefetchedCookies = setCookies;
      const newAccessToken = extractTokenFromSetCookie(setCookies, 'access_token');
      if (newAccessToken) token = newAccessToken;
    }
  }

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  // Relay inbound cookies for refresh-bearing calls
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) headers.set('cookie', cookieHeader);
  if (token) headers.set('authorization', `Bearer ${token}`);

  const url = `${apiBaseUrl}/api/auth/${path.join('/')}${request.nextUrl.search}`;
  const apiRes = await fetch(url, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
    redirect: 'manual',
  });

  const nextRes = new NextResponse(apiRes.body, {
    status: apiRes.status,
    headers: { 'content-type': apiRes.headers.get('content-type') ?? 'application/json' },
  });
  // Relay redirects (used by the OAuth flow in slice 01-04)
  const location = apiRes.headers.get('location');
  if (location) nextRes.headers.set('Location', location);
  // Relay the silent-refresh Set-Cookie headers first (rotated tokens)
  for (const cookie of prefetchedCookies) {
    nextRes.headers.append('Set-Cookie', cookie);
  }
  // Relay EVERY Set-Cookie from the actual API response — append() never set() (Pitfall 3)
  for (const cookie of apiRes.headers.getSetCookie()) {
    nextRes.headers.append('Set-Cookie', cookie);
  }
  return nextRes;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
