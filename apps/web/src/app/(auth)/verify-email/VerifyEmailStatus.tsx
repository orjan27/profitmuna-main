'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Verifying…</CardTitle>
          <CardDescription>Hold on while we confirm your email.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (state === 'success') {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Email verified</CardTitle>
          <CardDescription>Your email is confirmed — you can sign in now.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <a href="/login">Go to login</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        {state === 'failure' ? (
          <>
            <CardTitle>Verification failed</CardTitle>
            <CardDescription>
              That link is invalid or has expired. Enter your email to get a new one.
            </CardDescription>
          </>
        ) : (
          <>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We sent you a verification link. Didn&apos;t get it? Resend below.
            </CardDescription>
          </>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleResend} className="flex flex-col gap-4" noValidate>
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
      </CardContent>
    </Card>
  );
}
