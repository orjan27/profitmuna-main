import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// BFF catch-all proxy (D-01): the browser only ever calls this same-origin
// route; we forward server-to-server to the Workers API and relay Set-Cookie.
// NOTE: transparent-refresh logic (near-expiry detection + silent /refresh
// call) is added in slice 01-02 once the refresh endpoint exists; this slice
// only needs the relay + forward so register/verify work end-to-end.

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  // Server-only env — intentionally NOT NEXT_PUBLIC
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8793';

  // cookies() is async in Next.js 15
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  // Relay inbound cookies for refresh-bearing calls
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) headers.set('cookie', cookieHeader);
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

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
  // Relay EVERY Set-Cookie — append() in a loop, never set() (it overwrites)
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
