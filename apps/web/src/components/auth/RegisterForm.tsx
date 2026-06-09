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
  name?: string;
  password?: string;
}

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (!email.includes('@')) errors.email = 'Enter a valid email address';
    if (name.trim().length === 0) errors.name = 'Enter your name';
    if (password.length < 8) errors.password = 'Password must be at least 8 characters';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Same-origin BFF — never the Workers API directly
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, name, password }),
      });
      if (res.status === 201) {
        toast.success('Account created — check your email to verify.');
        router.push('/verify-email');
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
    <div className="w-full">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Create your account</h1>
      <p className="mt-2 text-base text-ink-soft">
        Start allocating your income the Profit Muna way.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="register-email">Email</Label>
          <Input
            id="register-email"
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
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="register-name">Name</Label>
          <Input
            id="register-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="h-11 bg-[oklch(0.972_0.005_85)]"
          />
          {fieldErrors.name ? <p className="text-sm text-destructive">{fieldErrors.name}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="register-password">Password</Label>
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="h-11 bg-[oklch(0.972_0.005_85)]"
          />
          {fieldErrors.password ? (
            <p className="text-sm text-destructive">{fieldErrors.password}</p>
          ) : null}
        </div>
        <Button type="submit" disabled={submitting} className="mt-1 h-11 w-full">
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-8 text-sm text-ink-faint">
        Already have an account?{' '}
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
