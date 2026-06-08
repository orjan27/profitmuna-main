'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FieldErrors {
  email?: string;
  password?: string;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (!email.includes('@')) errors.email = 'Enter a valid email address';
    if (password.length === 0) errors.password = 'Enter your password';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Same-origin BFF — never the Workers API directly (D-01)
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.status === 200) {
        router.push('/overview');
      } else if (res.status === 403) {
        // email_not_verified
        const body = (await res.json()) as { error?: { code?: string } };
        if (body.error?.code === 'email_not_verified') {
          setFieldErrors({
            email: 'Your email is not verified. Check your inbox or resend the verification email.',
          });
        } else {
          toast.error('Login failed. Please try again.');
        }
      } else if (res.status === 401) {
        toast.error('Invalid email or password.');
      } else if (res.status === 429) {
        toast.error('Too many failed attempts. Please wait 15 minutes and try again.');
      } else if (res.status === 422) {
        setFieldErrors({ email: 'Please check your details and try again.' });
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    } catch {
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendVerification() {
    if (!email.includes('@')) {
      setFieldErrors({ email: 'Enter your email address to resend the verification link.' });
      return;
    }
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Generic response regardless of outcome (enumeration mitigation)
      toast.success('If your account exists, a new verification email has been sent.');
    } catch {
      toast.error('Could not reach the server. Please try again.');
    }
  }

  const showResend = fieldErrors.email?.includes('not verified');

  return (
    <div className="w-full">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-2 text-base text-ink-soft">Pick up where your money left off.</p>

      {/* Continue with Google — the prominent path; activates in slice 01-04 */}
      <a
        href="/api/auth/google"
        className="mt-8 flex h-11 w-full items-center justify-center gap-3 rounded-md bg-[oklch(0.22_0.006_90)] text-sm font-medium text-[oklch(0.97_0.004_90)] transition-colors hover:bg-[oklch(0.28_0.006_90)]"
      >
        <span className="flex size-5 items-center justify-center rounded-[5px] bg-white">
          <GoogleGlyph />
        </span>
        Continue with Google
      </a>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-hairline" />
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-ink-faint">
          or use email
        </span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@profitmuna.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 bg-[oklch(0.972_0.005_85)]"
          />
          {fieldErrors.email ? (
            <p className="text-sm text-destructive">{fieldErrors.email}</p>
          ) : null}
          {showResend ? (
            <button
              type="button"
              onClick={handleResendVerification}
              className="self-start text-sm text-[oklch(0.6_0.17_28)] underline-offset-4 hover:underline"
            >
              Resend verification email
            </button>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="login-password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-ink-faint underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              Forgot?
            </Link>
          </div>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-11 bg-[oklch(0.972_0.005_85)]"
          />
          {fieldErrors.password ? (
            <p className="text-sm text-destructive">{fieldErrors.password}</p>
          ) : null}
        </div>
        <Button type="submit" variant="outline" disabled={submitting} className="h-11 w-full">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-8 text-sm text-ink-faint">
        New here?{' '}
        <Link
          href="/register"
          className="font-medium text-[oklch(0.6_0.17_28)] underline-offset-4 transition-colors hover:text-[oklch(0.52_0.17_28)] hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

function GoogleGlyph(): React.JSX.Element {
  return (
    <svg viewBox="0 0 48 48" className="size-3.5" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001 6.19 5.238 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
