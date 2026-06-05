// Uses Web Crypto globals (available on all Cloudflare Workers runtimes).
// No Node crypto — Workers does not have it.

/**
 * Encodes an ArrayBuffer as a lowercase hex string.
 */
export function encodeHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates a cryptographically-random token.
 * The raw token rides in email links; only its sha256 hash is stored.
 * @returns 64-char lowercase hex string (32 random bytes)
 */
export function generateSecureToken(): string {
  return encodeHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
}

/**
 * Hashes a token with SHA-256 for storage/lookup.
 * @param token - Raw token value
 * @returns 64-char lowercase hex sha256 digest
 */
export async function sha256Hash(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return encodeHex(hashBuffer);
}
