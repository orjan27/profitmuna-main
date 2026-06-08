'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Confirmed state: show the same message regardless of whether the account exists (T-03-02)
  const [submitted, setSubmitted] = useState(false);

  function validate(): boolean {
    if (!email.includes('@')) {
      setEmailError('Enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Same-origin BFF — never the Workers API directly
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Always show the same confirmation — do not reveal whether the account exists (T-03-02)
      setSubmitted(true);
    } catch {
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="w-full">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Check your email</h1>
        <p className="mt-2 text-base text-ink-soft">
          If an account with that address exists, a reset link has been sent. Check your inbox.
        </p>
        <p className="mt-6 text-sm text-ink-faint">
          Didn&apos;t receive an email? Check your spam folder or{' '}
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            try again
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Forgot your password?</h1>
      <p className="mt-2 text-base text-ink-soft">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="forgot-email">Email</Label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            placeholder="you@profitmuna.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 bg-[oklch(0.972_0.005_85)]"
          />
          {emailError ? <p className="text-sm text-destructive">{emailError}</p> : null}
        </div>
        <Button type="submit" disabled={submitting} className="h-11 w-full">
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p className="mt-8 text-sm text-ink-faint">
        Remembered it?{' '}
        <Link
          href="/login"
          className="font-medium text-[oklch(0.6_0.17_28)] underline-offset-4 transition-colors hover:text-[oklch(0.52_0.17_28)] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
