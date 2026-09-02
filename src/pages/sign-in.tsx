import { ArrowLeft, Building2, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { authClient } from '@/modules/auth/client';

type AuthMethods = {
  passwordEnabled: boolean;
  provider: {
    type: 'GOOGLE' | 'MICROSOFT' | 'SLACK' | 'ACTIVE_DIRECTORY';
    displayName: string;
    authProvider: 'google' | 'microsoft' | 'slack';
  } | null;
};

export default function SignIn() {
  const router = useRouter();
  const session = authClient.useSession();
  const [email, setEmail] = useState('');
  const [methods, setMethods] = useState<AuthMethods>();
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/setup/status')
      .then(async (response) => {
        const body = (await response.json()) as { data?: { setupRequired: boolean } };
        if (active && body.data?.setupRequired) await router.replace('/setup');
      })
      .catch(() => {
        if (active) setError('Unable to verify the installation status. Try again.');
      })
      .finally(() => {
        if (active) setCheckingSetup(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!session.isPending && session.data) void router.replace('/');
  }, [router, session.data, session.isPending]);

  useEffect(() => {
    const callbackError = router.query.error;
    if (typeof callbackError === 'string') {
      setError('Single sign-on could not be completed. Verify your account and try again.');
    }
  }, [router.query.error]);

  async function discoverMethods(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/v1/auth/methods?email=${encodeURIComponent(email)}`);
      const body = (await response.json()) as {
        data?: AuthMethods;
        error?: { message?: string };
      };
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message ?? 'Unable to find sign-in methods.');
      }
      setMethods(body.data);
    } catch (methodError) {
      setError(methodError instanceof Error ? methodError.message : 'Unable to continue.');
    } finally {
      setBusy(false);
    }
  }

  async function signInWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({
      email,
      password: String(form.get('password')),
    });
    if (result.error) {
      setError(result.error.message ?? 'Unable to sign in');
      setBusy(false);
      return;
    }
    if (result.data && 'url' in result.data && typeof result.data.url === 'string') {
      window.location.assign(result.data.url);
      return;
    }
    await router.push('/');
  }

  async function signInWithSso() {
    if (!methods?.provider) return;
    setBusy(true);
    setError('');
    const result = await authClient.signIn.social({
      provider: methods.provider.authProvider,
      callbackURL: '/',
      errorCallbackURL: '/sign-in',
      loginHint: email,
    });
    if (result.error) {
      setError(result.error.message ?? 'Unable to start single sign-on.');
      setBusy(false);
    }
  }

  if (checkingSetup || session.isPending || session.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#15112b] text-white">
        <div className="text-center" role="status">
          <Loader2 className="mx-auto animate-spin text-violet-300 motion-reduce:animate-none" />
          <p className="mt-4 text-sm text-violet-200">Preparing secure sign-in...</p>
        </div>
      </main>
    );
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
            Your organization controls whether you enter with a password or its identity provider.
          </p>
        </div>
        <p className="text-sm text-violet-300">Self-hosted. Auditable. Yours.</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2 text-xl font-bold lg:hidden">
            <ShieldCheck /> Authy
          </div>
          <p className="text-sm font-semibold uppercase tracking-[.16em] text-primary">
            Organization access
          </p>
          <h2 className="mt-2 text-3xl font-semibold">Welcome back</h2>
          <p className="mt-2 text-slate-500">
            Enter your work email to continue with your organization&apos;s sign-in policy.
          </p>
          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {error}
            </div>
          )}

          {!methods ? (
            <form onSubmit={discoverMethods}>
              <label className="mt-8 block text-sm font-medium">
                Work email
                <input
                  className="input mt-2"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <button className="button mt-7 w-full" disabled={busy}>
                {busy ? 'Checking...' : 'Continue'}
              </button>
            </form>
          ) : (
            <div className="mt-8">
              <button
                className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-foreground"
                type="button"
                onClick={() => {
                  setMethods(undefined);
                  setError('');
                }}
              >
                <ArrowLeft size={15} /> {email}
              </button>
              {methods.provider && !methods.passwordEnabled ? (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Building2 size={20} />
                  </span>
                  <h3 className="mt-4 font-semibold">
                    Continue with {methods.provider.displayName}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Password sign-in is disabled for this organization. Authentication continues
                    securely with {providerLabel(methods.provider.type)}.
                  </p>
                  <button
                    className="button mt-5 w-full"
                    type="button"
                    disabled={busy}
                    onClick={() => void signInWithSso()}
                  >
                    {busy ? 'Redirecting...' : `Sign in with ${methods.provider.displayName}`}
                  </button>
                </div>
              ) : (
                <form onSubmit={signInWithPassword}>
                  <label className="block text-sm font-medium">
                    Password
                    <span className="relative mt-2 block">
                      <KeyRound
                        className="pointer-events-none absolute left-3 top-3 text-slate-400"
                        size={17}
                      />
                      <input
                        className="input pl-10"
                        name="password"
                        type="password"
                        required
                        autoComplete="current-password"
                      />
                    </span>
                  </label>
                  <button className="button mt-7 w-full" disabled={busy}>
                    {busy ? 'Signing in...' : 'Sign in'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function providerLabel(type: NonNullable<AuthMethods['provider']>['type']): string {
  if (type === 'GOOGLE') return 'Google Workspace';
  if (type === 'SLACK') return 'Slack';
  return type === 'ACTIVE_DIRECTORY' ? 'Microsoft Entra ID / Active Directory' : 'Microsoft';
}
