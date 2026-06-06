import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  // D-discretion: 8-char minimum, server-side only for v1
  password: z.string().min(8),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

/**
 * Google OpenID Connect userinfo payload (the subset we consume).
 * Narrows the untrusted external response at the boundary (CR-01 / WR-05):
 * a malformed payload throws instead of leaking `undefined` fields into
 * upsertGoogleUser; `email_verified` is checked by the caller before linking.
 */
export const googleUserinfoSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  email_verified: z.boolean(),
});
