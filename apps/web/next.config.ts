import type { NextConfig } from 'next';

// Static security headers applied to every route (security.md / WR-06).
// HSTS is also enforced at the Cloudflare edge in production — kept here as
// defense-in-depth per plan 01-01 decisions_resolved.
//
// Content-Security-Policy is NOT set here: it requires a per-request nonce for
// Next.js's inline bootstrap/streaming scripts, so it's emitted from
// `src/middleware.ts`. A static `script-src 'self'` here would blank the page.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  // Strip the default X-Powered-By: Next.js header in all envs (WR-07)
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
