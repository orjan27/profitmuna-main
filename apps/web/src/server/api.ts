import 'server-only';

import { cookies } from 'next/headers';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:8793';

/**
 * Structured error thrown when the Workers API returns a non-ok response.
 * Consumers can inspect `status` and `code` to handle specific errors
 * (e.g. redirect on 401, surface message on 422).
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

/**
 * Server-only fetch client for calling the Workers API from server actions
 * and server components. Never import from client components.
 *
 * Reads the access_token cookie (async in Next.js 15) and sets the Bearer
 * Authorization header when present. Matches the BFF proxy pattern in
 * apps/web/src/app/api/auth/[...path]/route.ts.
 *
 * @param path - API path (e.g. '/api/incomes?page=0')
 * @param init - Optional RequestInit (method, body, etc.)
 * @returns Parsed JSON response body typed as T
 * @throws ApiError on non-ok responses
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookieStore = await cookies(); // async in Next.js 15 — matches route.ts line 64
  const accessToken = cookieStore.get('access_token')?.value;

  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  // 204 No Content — return undefined cast to T (caller knows to expect void)
  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: { code: 'unknown' } }))) as {
      error?: { code?: string };
    };
    throw new ApiError(res.status, body.error?.code ?? 'unknown');
  }

  return res.json() as Promise<T>;
}
