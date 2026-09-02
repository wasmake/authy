import { ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { authClient } from '@/modules/auth/client';

export default function SignIn() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    if (result.error) {
      setError(result.error.message ?? 'Unable to sign in');
      setBusy(false);
    } else await router.push('/');
  }
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden bg-[#15112b] p-16 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 text-xl font-bold">
          <ShieldCheck /> Authy
        </div>
        <div>
          <p className="mb-5 text-sm font-semibold uppercase tracking-[.2em] text-violet-300">
            One secure front door
          </p>
          <h1 className="max-w-xl text-5xl font-semibold leading-tight">
            Every application.
            <br />
            Exactly the right access.
          </h1>
          <p className="mt-6 max-w-md text-lg text-violet-200">
            A focused identity platform for teams that own their infrastructure.
          </p>
        </div>
        <p className="text-sm text-violet-300">Self-hosted. Auditable. Yours.</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <form className="w-full max-w-sm" onSubmit={submit}>
          <div className="mb-10 flex items-center gap-2 text-xl font-bold lg:hidden">
            <ShieldCheck />
            Authy
          </div>
          <h2 className="text-3xl font-semibold">Welcome back</h2>
          <p className="mt-2 text-slate-500">Sign in to your organization workspace.</p>
          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950"
            >
              {error}
            </div>
          )}
          <label className="mt-8 block text-sm font-medium">
            Work email
            <input
              className="input mt-2"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue="admin@acme.test"
            />
          </label>
          <label className="mt-5 block text-sm font-medium">
            Password
            <input
              className="input mt-2"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              defaultValue="DemoPassword123!"
            />
          </label>
          <button className="button mt-7 w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <button type="button" className="mt-4 w-full text-sm text-primary">
            Forgot password?
          </button>
        </form>
      </section>
    </main>
  );
}
