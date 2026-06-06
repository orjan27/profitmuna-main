'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface VerifyEmailStatusProps {
  token?: string;
}

type VerifyState = 'idle' | 'verifying' | 'success' | 'failure';

export function VerifyEmailStatus({ token }: VerifyEmailStatusProps) {
  const [state, setState] = useState<VerifyState>(token ? 'verifying' : 'idle');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!cancelled) setState(res.ok ? 'success' : 'failure');
      } catch {
        if (!cancelled) setState('failure');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!resendEmail.includes('@')) {
      toast.error('Enter a valid email address.');
      return;
    }
    setResending(true);
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });
      // Generic confirmation regardless of account existence
      toast.success('If that email has an unverified account, a new link is on its way.');
    } catch {
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setResending(false);
    }
  }

  if (state === 'verifying') {
    return (
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold tracking-tight">Verifying…</h1>
        <p className="mt-1 text-sm text-ink-soft">Hold on while we confirm your email.</p>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold tracking-tight">Email verified</h1>
        <p className="mt-1 text-sm text-ink-soft">Your email is confirmed. You can sign in now.</p>
        <Button asChild className="mt-8 w-full">
          <a href="/login">Go to login</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      {state === 'failure' ? (
        <>
          <h1 className="text-xl font-semibold tracking-tight">Verification failed</h1>
          <p className="mt-1 text-sm text-ink-soft">
            That link is invalid or has expired. Enter your email to get a new one.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-1 text-sm text-ink-soft">
            We sent you a verification link. Didn&apos;t get it? Resend below.
          </p>
        </>
      )}

      <form onSubmit={handleResend} className="mt-8 flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="resend-email">Email</Label>
          <Input
            id="resend-email"
            type="email"
            autoComplete="email"
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="outline" disabled={resending}>
          {resending ? 'Sending…' : 'Resend verification link'}
        </Button>
      </form>
    </div>
  );
}
