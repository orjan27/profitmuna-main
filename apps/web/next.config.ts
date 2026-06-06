import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';

// Next.js needs 'unsafe-eval' (and inline scripts) for its dev/HMR runtime.
// In production we drop them to keep XSS defense strong (WR-06). Moving to a
// nonce-based script CSP via middleware is a future hardening pass (deferred —
// out of this phase's scope).
const scriptSrc = isProduction
  ? "script-src 'self'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

// Security response headers required by security.md, applied to every route.
// HSTS is also enforced at the Cloudflare edge in production — kept here as
// defense-in-depth per plan 01-01 decisions_resolved.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      scriptSrc,
      // 'unsafe-inline' for styles is required by Tailwind's injected styles
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      // Browser only talks to the same-origin BFF — never the Workers API
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig: NextConfig = {
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
