import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// BFF catch-all proxy for Profit First allocation routes.
// Forwards server-to-server to the Workers API with the user's Bearer token.
// No transparent-refresh or Set-Cookie relay needed: PF routes are authenticated
// and set no cookies; middleware.ts already redirects unauthenticated users to /login.

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  // Server-only env — intentionally NOT NEXT_PUBLIC_
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8793';

  // cookies() is async in Next.js 15
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  // Relay inbound cookies if present
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) headers.set('cookie', cookieHeader);
  // Forward the Bearer token for requireAuth middleware on the API
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

  const url = `${apiBaseUrl}/api/profit-first/${path.join('/')}${request.nextUrl.search}`;
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

export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
