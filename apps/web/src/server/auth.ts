// Server-only module — never import from client components.
// Decodes the access token for UI gating; actual verification is the API's job.
import { cookies } from 'next/headers';

export type Session = {
  userId: number;
};

/**
 * Reads the access_token cookie and decodes the sub claim (without verification)
 * for lightweight server-component UI gating.
 *
 * Verification is always performed by the Workers API — this is only used to
 * decide whether to show authenticated or unauthenticated UI on the server.
 *
 * @returns { userId } if an access_token cookie is present and decodable, otherwise null.
 */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies(); // async in Next.js 15
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
    ) as { sub?: string };
    const userId = Number(payload.sub);
    if (!Number.isFinite(userId) || userId <= 0) return null;
    return { userId };
  } catch {
    return null;
  }
}
