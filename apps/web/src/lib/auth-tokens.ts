// Pure auth-token helpers shared by middleware.ts and the auth BFF proxy.
// Framework-agnostic — no Next.js imports (lib/ rule).

/**
 * Decodes the JWT exp claim without verifying the signature.
 * Verification is the API's responsibility — this is purely for near-expiry detection.
 *
 * @returns true if the token is expiring within 60 seconds or the claim is absent/unreadable.
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
 * Extracts a cookie value from a Set-Cookie header array.
 */
export function extractTokenFromSetCookie(setCookies: string[], name: string): string | undefined {
  for (const header of setCookies) {
    const [nameValue] = header.split(';');
    const [cookieName, ...valueParts] = nameValue.split('=');
    if (cookieName.trim() === name) {
      return valueParts.join('=').trim();
    }
  }
  return undefined;
}

/**
 * Splices updated cookie values into a request Cookie header string.
 * Existing cookies named in `updates` are replaced in place; missing ones are
 * appended. Used by middleware to make a freshly-refreshed access token
 * visible to the downstream RSC render of the same request.
 */
export function rewriteCookieHeader(
  original: string | null,
  updates: Record<string, string>
): string {
  const pending = { ...updates };
  const segments = (original ?? '')
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const eqIndex = segment.indexOf('=');
      const name = eqIndex === -1 ? segment : segment.slice(0, eqIndex);
      if (name in pending) {
        const value = pending[name];
        delete pending[name];
        return `${name}=${value}`;
      }
      return segment;
    });
  for (const [name, value] of Object.entries(pending)) {
    segments.push(`${name}=${value}`);
  }
  return segments.join('; ');
}
