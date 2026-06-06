import { encodeHex } from '@/lib/token';

// PBKDF2-SHA256 with 210k iterations — the Workers-native equivalent of
// bcrypt cost>=12 (documented deviation in plan 01-01 decisions_resolved).
// bcryptjs risks CPU-timeout on Workers; crypto.subtle PBKDF2 is native-speed.
const PBKDF2_ITERATIONS = 210000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const SCHEME_PREFIX = 'pbkdf2$sha256$';

async function deriveHex(
  plain: string,
  saltBytes: Uint8Array,
  iterations: number
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(plain),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBytes as unknown as BufferSource,
      iterations,
    },
    keyMaterial,
    HASH_BYTES * 8
  );
  return encodeHex(bits);
}

/**
 * Constant-time comparison of two equal-length hex strings (security.md).
 * Returns false immediately only on length mismatch (length is not secret).
 */
function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Hashes a plaintext password with PBKDF2-SHA256.
 * @param plain - The plaintext password
 * @returns Encoded string: pbkdf2$sha256$<iterations>$<saltHex>$<hashHex>
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hashHex = await deriveHex(plain, salt, PBKDF2_ITERATIONS);
  return `${SCHEME_PREFIX}${PBKDF2_ITERATIONS}$${encodeHex(salt.buffer)}$${hashHex}`;
}

/**
 * Verifies a plaintext password against a stored PBKDF2 hash string.
 * @param plain - The plaintext password to check
 * @param stored - Encoded hash from hashPassword
 * @returns true when the password matches
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;
  const iterations = Number(parts[2]);
  const saltHex = parts[3];
  const expectedHex = parts[4];
  if (!Number.isInteger(iterations) || iterations <= 0 || !saltHex || !expectedHex) return false;
  // Reject malformed/tampered salt hex explicitly rather than silently parsing
  // a trailing nibble into a NaN byte (WR-09): must be an even-length hex string.
  if (!/^[0-9a-f]+$/i.test(saltHex) || saltHex.length % 2 !== 0) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []);
  if (salt.length === 0) return false;
  const actualHex = await deriveHex(plain, salt, iterations);
  return constantTimeEqualHex(actualHex, expectedHex);
}
