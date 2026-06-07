'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ResetPasswordFormProps {
  token: string;
}

interface FieldErrors {
  password?: string;
  confirm?: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (password.length < 8) errors.password = 'Password must be at least 8 characters';
    if (password !== confirm) errors.confirm = 'Passwords do not match';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (res.status === 200) {
        toast.success('Password reset — please sign in with your new password.');
        router.push('/login');
      } else if (res.status === 400) {
        toast.error('This reset link has expired or already been used. Please request a new one.');
      } else if (res.status === 422) {
        setFieldErrors({ password: 'Please check your details and try again.' });
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    } catch {
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Choose a strong password of at least 8 characters.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-password">New password</Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          {fieldErrors.password ? (
            <p className="text-sm text-destructive">{fieldErrors.password}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-confirm">Confirm new password</Label>
          <Input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {fieldErrors.confirm ? (
            <p className="text-sm text-destructive">{fieldErrors.confirm}</p>
          ) : null}
        </div>
        <Button type="submit" disabled={submitting} className="max-sm:h-11">
          {submitting ? 'Saving…' : 'Set new password'}
        </Button>
      </form>
    </div>
  );
}
