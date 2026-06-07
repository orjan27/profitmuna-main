import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// BFF catch-all proxy for /api/notifications/*: the browser only ever calls this same-origin route;
// we forward server-to-server to the Workers API.
// All notification routes require authentication — no unauthenticated-path branching needed.
// middleware.ts redirects unauthenticated users to /login before they can reach these routes.

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  // Server-only env — intentionally NOT NEXT_PUBLIC_
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8793';

  // cookies() is async in Next.js 15
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  // Relay inbound cookies for auth-bearing calls
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) headers.set('cookie', cookieHeader);
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

  const url = `${apiBaseUrl}/api/notifications/${path.join('/')}${request.nextUrl.search}`;
  const apiRes = await fetch(url, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
    redirect: 'manual',
  });

  return new NextResponse(apiRes.body, {
    status: apiRes.status,
    headers: { 'content-type': apiRes.headers.get('content-type') ?? 'application/json' },
  });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
