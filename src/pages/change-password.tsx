import {
  Check,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { authClient } from '@/modules/auth/client';
import { parseOidcContinuation } from '@/modules/auth/oidc-continuation';
import { meetsPasswordPolicy, passwordRequirementResults } from '@/modules/users/password-policy';

export default function ChangePassword() {
  const router = useRouter();
  const session = authClient.useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [credentialChanged, setCredentialChanged] = useState(false);
  const continuation = parseOidcContinuation(router.query.continue);

  useEffect(() => {
    if (!session.isPending && !session.data) void router.replace('/sign-in');
  }, [router, session.data, session.isPending]);

  const requirements = passwordRequirementResults(newPassword);
  const confirmationMatches = confirmation.length > 0 && confirmation === newPassword;
  const validPassword = meetsPasswordPolicy(newPassword);
  const completedChecks =
    requirements.filter(({ met }) => met).length + Number(confirmationMatches);
  const strength = Math.round((completedChecks / (requirements.length + 1)) * 100);
  const canSubmit =
    credentialChanged ||
    (currentPassword.length > 0 &&
      validPassword &&
      confirmationMatches &&
      currentPassword !== newPassword);

  async function finishRotation() {
    const response = await fetch('/api/v1/account/password-changed', { method: 'POST' });
    const body = (await response.json().catch(() => null)) as {
      data?: { onboardingCompletedAt?: string | null };
      error?: { message?: string };
    } | null;
    if (!response.ok) {
      throw new Error(body?.error?.message ?? 'Unable to finish securing your account.');
    }
    await router.replace(continuation ?? (body?.data?.onboardingCompletedAt ? '/' : '/?tour=1'));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError('');
    let passwordChanged = credentialChanged;

    try {
      if (!credentialChanged) {
        const result = await authClient.changePassword({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        });
        if (result.error)
          throw new Error(result.error.message ?? 'Unable to change your password.');
        passwordChanged = true;
        setCredentialChanged(true);
      }
      await finishRotation();
    } catch (submitError) {
      setError(
        passwordChanged
          ? 'Your password changed, but setup could not finish. Select Continue to try again.'
          : submitError instanceof Error
            ? submitError.message
            : 'Unable to change your password.',
      );
      setBusy(false);
    }
  }

  if (session.isPending || !session.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0d1020] text-white">
        <div className="text-center" role="status">
          <Loader2
            aria-hidden="true"
            className="mx-auto animate-spin text-violet-300 motion-reduce:animate-none"
            size={30}
          />
          <p className="mt-4 text-sm text-slate-300">Verifying your secure session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5f5fa] px-4 py-8 text-slate-950 dark:bg-[#080a13] dark:text-white sm:px-6 lg:grid lg:place-items-center lg:py-12">
      <div className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-[28rem] w-[28rem] rounded-full bg-emerald-400/10 blur-3xl" />

      <section className="relative mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-[#111421] dark:shadow-black/30 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="relative overflow-hidden bg-[#15172d] p-7 text-white sm:p-10 lg:p-12">
          <div className="absolute -right-20 top-16 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="relative flex items-center gap-3 text-xl font-bold">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500 shadow-lg shadow-violet-950/50">
              <ShieldCheck aria-hidden="true" size={22} />
            </span>
            Authy
          </div>
          <div className="relative mt-12 lg:mt-28">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-violet-300">
              Credential protection
            </p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
              Replace your temporary password.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-300">
              Create a replacement password known only to you before continuing. Other sessions will
              be revoked automatically.
            </p>
            <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <LockKeyhole aria-hidden="true" className="shrink-0 text-emerald-300" size={21} />
              <p className="text-sm text-slate-200">Your current session stays active securely.</p>
            </div>
          </div>
        </aside>

        <div className="p-6 sm:p-10 lg:p-12">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
              <KeyRound aria-hidden="true" size={21} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Required</p>
              <h2 className="text-xl font-semibold">Secure your account</h2>
            </div>
          </div>

          {error && (
            <div
              className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
              role="alert"
            >
              {error}
            </div>
          )}

          <form className="mt-7" onSubmit={submit} noValidate>
            {!credentialChanged && (
              <>
                <label className="block text-sm font-medium" htmlFor="current-password">
                  Temporary password
                </label>
                <input
                  autoComplete="current-password"
                  className="input mt-2"
                  id="current-password"
                  maxLength={128}
                  onChange={(event) => {
                    setCurrentPassword(event.target.value);
                    setError('');
                  }}
                  required
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                />

                <div className="mt-5 flex items-center justify-between">
                  <label className="text-sm font-medium" htmlFor="new-password">
                    New password
                  </label>
                  <button
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-primary"
                    onClick={() => setShowPasswords((visible) => !visible)}
                    type="button"
                  >
                    {showPasswords ? (
                      <EyeOff aria-hidden="true" size={15} />
                    ) : (
                      <Eye aria-hidden="true" size={15} />
                    )}
                    {showPasswords ? 'Hide passwords' : 'Show passwords'}
                  </button>
                </div>
                <input
                  aria-describedby="password-requirements"
                  autoComplete="new-password"
                  className="input mt-2"
                  id="new-password"
                  maxLength={128}
                  minLength={14}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setError('');
                  }}
                  required
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                />

                <label className="mt-5 block text-sm font-medium" htmlFor="password-confirmation">
                  Confirm new password
                </label>
                <input
                  aria-describedby="password-requirements"
                  autoComplete="new-password"
                  className="input mt-2"
                  id="password-confirmation"
                  maxLength={128}
                  onChange={(event) => {
                    setConfirmation(event.target.value);
                    setError('');
                  }}
                  required
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmation}
                />

                <div
                  className="mt-5 rounded-2xl border border-border bg-slate-50 p-4 dark:bg-slate-950/30"
                  id="password-requirements"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      High-security password
                    </p>
                    <span className="text-xs font-semibold text-primary">{strength}%</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 motion-reduce:transition-none ${
                        strength === 100 ? 'bg-emerald-500' : 'bg-violet-500'
                      }`}
                      style={{ width: `${strength}%` }}
                    />
                  </div>
                  <ul className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                    {requirements.map((requirement) => (
                      <li
                        className={`flex items-center gap-2 transition-colors motion-reduce:transition-none ${
                          requirement.met
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-500'
                        }`}
                        key={requirement.key}
                      >
                        {requirement.met ? (
                          <Check aria-hidden="true" size={14} />
                        ) : (
                          <Circle aria-hidden="true" size={12} />
                        )}
                        {requirement.label}
                      </li>
                    ))}
                    <li
                      className={`flex items-center gap-2 transition-colors motion-reduce:transition-none ${
                        confirmationMatches
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {confirmationMatches ? (
                        <Check aria-hidden="true" size={14} />
                      ) : (
                        <Circle aria-hidden="true" size={12} />
                      )}
                      Passwords match
                    </li>
                  </ul>
                </div>
                {newPassword && currentPassword === newPassword && (
                  <p className="mt-3 text-sm text-red-600" role="alert">
                    Your new password must differ from the temporary password.
                  </p>
                )}
              </>
            )}

            {credentialChanged && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <div className="flex gap-3">
                  <Check aria-hidden="true" className="mt-0.5 shrink-0" size={20} />
                  <div>
                    <p className="font-semibold">Your new password is active</p>
                    <p className="mt-1 text-sm opacity-80">
                      Continue to finish securing your account.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button className="button mt-6 w-full gap-2" disabled={!canSubmit || busy}>
              {busy && (
                <Loader2
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                  size={16}
                />
              )}
              {busy ? 'Securing account...' : credentialChanged ? 'Continue' : 'Change password'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
