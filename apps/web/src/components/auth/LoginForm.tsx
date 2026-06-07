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
    <div className="w-full max-w-sm">
      <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-ink-soft">Pick up where your money left off.</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {fieldErrors.email ? (
            <p className="text-sm text-destructive">{fieldErrors.email}</p>
          ) : null}
          {showResend ? (
            <button
              type="button"
              onClick={handleResendVerification}
              className="self-start text-sm text-primary underline-offset-4 hover:underline"
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
              Forgot password?
            </Link>
          </div>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {fieldErrors.password ? (
            <p className="text-sm text-destructive">{fieldErrors.password}</p>
          ) : null}
        </div>
        <Button type="submit" disabled={submitting} className="max-sm:h-11">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
        {/* Sign in with Google — activates in slice 01-04 */}
        <a
          href="/api/auth/google"
          className="flex items-center justify-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Sign in with Google
        </a>
      </form>

      <p className="mt-8 text-sm text-ink-faint">
        New here?{' '}
        <Link
          href="/register"
          className="text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
