import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';

type SetupForm = {
  organizationName: string;
  organizationSlug: string;
  firstName: string;
  lastName: string;
  email: string;
  companyRole: string;
  password: string;
  passwordConfirmation: string;
};

type FieldName = keyof SetupForm;
type FieldErrors = Partial<Record<FieldName, string>>;

const initialForm: SetupForm = {
  organizationName: '',
  organizationSlug: '',
  firstName: '',
  lastName: '',
  email: '',
  companyRole: '',
  password: '',
  passwordConfirmation: '',
};

const steps = [
  { label: 'Workspace', icon: Building2 },
  { label: 'Owner', icon: UserRound },
  { label: 'Security', icon: KeyRound },
  { label: 'Review', icon: CheckCircle2 },
] as const;

const passwordRequirements = [
  { label: '14 or more characters', test: (password: string) => password.length >= 14 },
  { label: 'Uppercase letter', test: (password: string) => /[A-Z]/.test(password) },
  { label: 'Lowercase letter', test: (password: string) => /[a-z]/.test(password) },
  { label: 'Number', test: (password: string) => /[0-9]/.test(password) },
  { label: 'Symbol', test: (password: string) => /[^A-Za-z0-9]/.test(password) },
  { label: 'No spaces', test: (password: string) => password.length > 0 && /^\S+$/.test(password) },
] as const;

export default function Setup() {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [checking, setChecking] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [slugEdited, setSlugEdited] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function checkStatus() {
      try {
        const response = await fetch('/api/v1/setup/status', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          data?: { setupRequired?: boolean };
          error?: { message?: string };
        };
        if (!response.ok || typeof body.data?.setupRequired !== 'boolean') {
          throw new Error(body.error?.message ?? 'Unable to check setup status.');
        }
        if (!body.data.setupRequired) {
          await router.replace('/sign-in');
          return;
        }
        setChecking(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatusError(error instanceof Error ? error.message : 'Unable to check setup status.');
        setChecking(false);
      }
    }
    void checkStatus();
    return () => controller.abort();
  }, [router]);

  useEffect(() => {
    if (!checking) headingRef.current?.focus();
  }, [checking, step]);

  function update(field: FieldName) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
      setSubmitError('');
    };
  }

  function updateOrganizationName(event: ChangeEvent<HTMLInputElement>) {
    const organizationName = event.target.value;
    setForm((current) => ({
      ...current,
      organizationName,
      organizationSlug: slugEdited ? current.organizationSlug : slugify(organizationName),
    }));
    setErrors((current) => ({
      ...current,
      organizationName: undefined,
      ...(!slugEdited ? { organizationSlug: undefined } : {}),
    }));
  }

  function updateSlug(event: ChangeEvent<HTMLInputElement>) {
    setSlugEdited(true);
    const organizationSlug = event.target.value.toLowerCase();
    setForm((current) => ({ ...current, organizationSlug }));
    setErrors((current) => ({ ...current, organizationSlug: undefined }));
  }

  function validate(currentStep: number): boolean {
    const nextErrors: FieldErrors = {};
    if (currentStep === 0) {
      if (form.organizationName.trim().length < 2) {
        nextErrors.organizationName = 'Enter an organization name with at least 2 characters.';
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.organizationSlug)) {
        nextErrors.organizationSlug = 'Use lowercase letters, numbers, and single hyphens.';
      } else if (form.organizationSlug.length < 2 || form.organizationSlug.length > 63) {
        nextErrors.organizationSlug = 'The slug must be between 2 and 63 characters.';
      }
    }
    if (currentStep === 1) {
      if (!form.firstName.trim()) nextErrors.firstName = 'Enter your first name.';
      if (!form.lastName.trim()) nextErrors.lastName = 'Enter your last name.';
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
        nextErrors.email = 'Enter a valid work email address.';
      }
      if (!form.companyRole.trim()) nextErrors.companyRole = 'Enter your role or job title.';
    }
    if (currentStep === 2) {
      if (!passwordRequirements.every((requirement) => requirement.test(form.password))) {
        nextErrors.password = 'Meet every password requirement before continuing.';
      } else if (form.password.length > 128) {
        nextErrors.password = 'Password must be no more than 128 characters.';
      }
      if (form.passwordConfirmation !== form.password) {
        nextErrors.passwordConfirmation = 'Passwords do not match.';
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError('');
    if (step < steps.length - 1) {
      if (validate(step)) setStep((current) => current + 1);
      return;
    }
    if (![0, 1, 2].every(validate)) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          companyRole: form.companyRole,
          organizationName: form.organizationName,
          organizationSlug: form.organizationSlug,
          password: form.password,
          passwordConfirmation: form.passwordConfirmation,
        }),
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        if (response.status === 409) {
          await router.replace('/sign-in');
          return;
        }
        throw new Error(body.error?.message ?? 'Unable to complete setup.');
      }
      await router.replace('/sign-in');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to complete setup.');
      setSubmitting(false);
    }
  }

  if (checking || statusError) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0e1020] p-6 text-white">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/20 text-violet-300">
            <ShieldCheck aria-hidden="true" size={30} />
          </span>
          {checking ? (
            <>
              <h1 className="mt-6 text-2xl font-semibold">Preparing your workspace</h1>
              <div className="mx-auto mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-violet-400" />
              </div>
              <p className="mt-4 text-sm text-slate-400" role="status">
                Checking installation status...
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-6 text-2xl font-semibold">Setup is temporarily unavailable</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400" role="alert">
                {statusError}
              </p>
              <button
                className="button mt-6"
                type="button"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f3fa] text-slate-950 dark:bg-[#090b14] dark:text-white lg:grid lg:grid-cols-[minmax(320px,0.8fr)_minmax(620px,1.2fr)]">
      <aside className="relative hidden min-h-screen overflow-hidden bg-[#111329] px-10 py-12 text-white lg:flex lg:flex-col xl:px-16">
        <div className="absolute -left-28 top-1/4 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute -right-20 bottom-16 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex items-center gap-3 text-xl font-bold">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500 shadow-lg shadow-violet-950/40">
            <ShieldCheck aria-hidden="true" size={23} />
          </span>
          Authy
        </div>
        <div className="relative my-auto max-w-md py-12">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300">
            Private by design
          </p>
          <h2 className="mt-5 text-4xl font-semibold leading-tight xl:text-5xl">
            Your identity platform starts here.
          </h2>
          <p className="mt-6 text-base leading-7 text-slate-300">
            Create the first owner and establish a secure home for your team. No demo accounts,
            shared passwords, or sample organizations.
          </p>
          <div className="mt-10 space-y-4">
            {[
              'One-time protected setup',
              'Strong credential security',
              'Owner access from day one',
            ].map((benefit) => (
              <div className="flex items-center gap-3 text-sm text-slate-200" key={benefit}>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                  <Check aria-hidden="true" size={14} />
                </span>
                {benefit}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-slate-500">Self-hosted. Auditable. Yours.</p>
      </aside>

      <section className="flex min-h-screen items-center justify-center p-4 sm:p-8 xl:p-12">
        <div className="w-full max-w-3xl">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white">
              <ShieldCheck aria-hidden="true" size={20} />
            </span>
            <span className="text-lg font-bold">Authy</span>
          </div>

          <ol className="mb-5 grid grid-cols-4 gap-2" aria-label="Setup progress">
            {steps.map(({ label, icon: Icon }, index) => (
              <li
                className={`flex min-w-0 items-center gap-2 text-xs font-semibold transition-colors ${
                  index <= step ? 'text-primary' : 'text-slate-400'
                }`}
                aria-current={index === step ? 'step' : undefined}
                key={label}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-all duration-300 ${
                    index < step
                      ? 'border-primary bg-primary text-white'
                      : index === step
                        ? 'border-primary bg-card shadow-sm'
                        : 'border-border bg-card'
                  }`}
                >
                  {index < step ? (
                    <Check aria-hidden="true" size={16} />
                  ) : (
                    <Icon aria-hidden="true" size={16} />
                  )}
                </span>
                <span className="hidden truncate sm:block">{label}</span>
              </li>
            ))}
          </ol>

          <div className="card overflow-hidden shadow-xl shadow-slate-900/5 dark:shadow-black/20">
            <div className="h-1 bg-border">
              <div
                className="h-full rounded-r-full bg-primary transition-all duration-500"
                style={{ width: `${((step + 1) / steps.length) * 100}%` }}
              />
            </div>
            <form onSubmit={submit} noValidate>
              <div className="min-h-[460px] p-6 sm:p-9">
                <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">
                  Step {step + 1} of {steps.length}
                </p>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="mt-2 text-2xl font-semibold sm:text-3xl"
                >
                  {step === 0 && 'Name your workspace'}
                  {step === 1 && 'Create the first owner'}
                  {step === 2 && 'Protect your account'}
                  {step === 3 && 'Review and launch'}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {step === 0 && 'This identifies your organization across the platform.'}
                  {step === 1 && 'Use your real details for audit trails and account recovery.'}
                  {step === 2 && 'Choose a unique password that is not used anywhere else.'}
                  {step === 3 &&
                    'Confirm the details below. You can update workspace settings later.'}
                </p>
                <p className="sr-only" aria-live="polite">
                  Step {step + 1} of {steps.length}: {steps[step].label}
                </p>

                {Object.keys(errors).length > 0 && (
                  <div
                    className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                    role="alert"
                  >
                    Check the highlighted fields before continuing.
                  </div>
                )}

                {step === 0 && (
                  <div className="mt-8 grid gap-5 sm:grid-cols-2">
                    <Field
                      label="Organization name"
                      name="organizationName"
                      error={errors.organizationName}
                      wide
                    >
                      <input
                        className="input mt-2"
                        id="organizationName"
                        name="organizationName"
                        value={form.organizationName}
                        onChange={updateOrganizationName}
                        autoComplete="organization"
                        maxLength={120}
                        aria-invalid={Boolean(errors.organizationName)}
                        aria-describedby={
                          errors.organizationName ? 'organizationName-error' : undefined
                        }
                      />
                    </Field>
                    <Field
                      label="Workspace URL"
                      name="organizationSlug"
                      error={errors.organizationSlug}
                      wide
                    >
                      <div className="mt-2 flex h-11 overflow-hidden rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
                        <span className="flex items-center border-r border-border bg-muted px-3 text-sm text-slate-500">
                          /
                        </span>
                        <input
                          className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                          id="organizationSlug"
                          name="organizationSlug"
                          value={form.organizationSlug}
                          onChange={updateSlug}
                          maxLength={63}
                          spellCheck={false}
                          aria-invalid={Boolean(errors.organizationSlug)}
                          aria-describedby={
                            errors.organizationSlug ? 'organizationSlug-error' : 'slug-hint'
                          }
                        />
                      </div>
                      {!errors.organizationSlug && (
                        <span
                          id="slug-hint"
                          className="mt-2 block text-xs font-normal text-slate-400"
                        >
                          Lowercase letters, numbers, and hyphens only.
                        </span>
                      )}
                    </Field>
                    <div className="sm:col-span-2 rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/40">
                      <div className="flex gap-3">
                        <Sparkles
                          className="mt-0.5 shrink-0 text-violet-600 dark:text-violet-300"
                          aria-hidden="true"
                          size={18}
                        />
                        <p className="text-sm leading-6 text-violet-900 dark:text-violet-200">
                          This installation is empty. Your workspace will be created without sample
                          users or applications.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="mt-8 grid gap-5 sm:grid-cols-2">
                    <Field label="First name" name="firstName" error={errors.firstName}>
                      <input
                        className="input mt-2"
                        id="firstName"
                        name="firstName"
                        value={form.firstName}
                        onChange={update('firstName')}
                        autoComplete="given-name"
                        maxLength={100}
                        aria-invalid={Boolean(errors.firstName)}
                        aria-describedby={errors.firstName ? 'firstName-error' : undefined}
                      />
                    </Field>
                    <Field label="Last name" name="lastName" error={errors.lastName}>
                      <input
                        className="input mt-2"
                        id="lastName"
                        name="lastName"
                        value={form.lastName}
                        onChange={update('lastName')}
                        autoComplete="family-name"
                        maxLength={100}
                        aria-invalid={Boolean(errors.lastName)}
                        aria-describedby={errors.lastName ? 'lastName-error' : undefined}
                      />
                    </Field>
                    <Field label="Work email" name="email" error={errors.email} wide>
                      <input
                        className="input mt-2"
                        id="email"
                        name="email"
                        value={form.email}
                        onChange={update('email')}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        maxLength={320}
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? 'email-error' : undefined}
                      />
                    </Field>
                    <Field
                      label="Role or job title"
                      name="companyRole"
                      error={errors.companyRole}
                      wide
                    >
                      <input
                        className="input mt-2"
                        id="companyRole"
                        name="companyRole"
                        value={form.companyRole}
                        onChange={update('companyRole')}
                        autoComplete="organization-title"
                        placeholder="e.g. Head of IT"
                        maxLength={120}
                        aria-invalid={Boolean(errors.companyRole)}
                        aria-describedby={errors.companyRole ? 'companyRole-error' : undefined}
                      />
                    </Field>
                  </div>
                )}

                {step === 2 && (
                  <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="space-y-5">
                      <Field label="Password" name="password" error={errors.password}>
                        <div className="relative mt-2">
                          <input
                            className="input pr-12"
                            id="password"
                            name="password"
                            value={form.password}
                            onChange={update('password')}
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            maxLength={128}
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={
                              errors.password ? 'password-error' : 'password-guidance'
                            }
                          />
                          <button
                            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-slate-400 transition hover:text-foreground"
                            type="button"
                            onClick={() => setShowPassword((visible) => !visible)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? (
                              <EyeOff aria-hidden="true" size={18} />
                            ) : (
                              <Eye aria-hidden="true" size={18} />
                            )}
                          </button>
                        </div>
                      </Field>
                      <Field
                        label="Confirm password"
                        name="passwordConfirmation"
                        error={errors.passwordConfirmation}
                      >
                        <input
                          className="input mt-2"
                          id="passwordConfirmation"
                          name="passwordConfirmation"
                          value={form.passwordConfirmation}
                          onChange={update('passwordConfirmation')}
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          maxLength={128}
                          aria-invalid={Boolean(errors.passwordConfirmation)}
                          aria-describedby={
                            errors.passwordConfirmation ? 'passwordConfirmation-error' : undefined
                          }
                        />
                      </Field>
                    </div>
                    <div
                      id="password-guidance"
                      className="rounded-2xl border border-border bg-muted/40 p-4"
                    >
                      <p className="text-xs font-bold uppercase tracking-[.12em] text-slate-500">
                        Password strength
                      </p>
                      <ul className="mt-4 space-y-3">
                        {passwordRequirements.map((requirement) => {
                          const met = requirement.test(form.password);
                          return (
                            <li
                              className={`flex items-center gap-2 text-xs transition-all duration-300 ${met ? 'translate-x-0 text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}
                              key={requirement.label}
                            >
                              {met ? (
                                <CheckCircle2 aria-hidden="true" className="shrink-0" size={16} />
                              ) : (
                                <Circle aria-hidden="true" className="shrink-0" size={16} />
                              )}
                              {requirement.label}
                            </li>
                          );
                        })}
                      </ul>
                      <span className="sr-only" aria-live="polite">
                        {
                          passwordRequirements.filter((requirement) =>
                            requirement.test(form.password),
                          ).length
                        }{' '}
                        of {passwordRequirements.length} password requirements met.
                      </span>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="mt-8 grid gap-5 sm:grid-cols-2">
                    <ReviewCard icon={<Building2 aria-hidden="true" size={18} />} title="Workspace">
                      <ReviewRow label="Name" value={form.organizationName.trim()} />
                      <ReviewRow label="URL" value={`/${form.organizationSlug}`} />
                    </ReviewCard>
                    <ReviewCard
                      icon={<UserRound aria-hidden="true" size={18} />}
                      title="First owner"
                    >
                      <ReviewRow
                        label="Name"
                        value={`${form.firstName.trim()} ${form.lastName.trim()}`}
                      />
                      <ReviewRow label="Email" value={form.email.trim()} />
                      <ReviewRow label="Role" value={form.companyRole.trim()} />
                    </ReviewCard>
                    <div className="sm:col-span-2 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                      <LockKeyhole className="mt-0.5 shrink-0" aria-hidden="true" size={18} />
                      <p className="text-sm leading-6">
                        Your password meets every security requirement and will be stored as a
                        one-way hash.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <footer className="flex flex-col-reverse gap-3 border-t border-border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-9">
                <button
                  className="button-secondary gap-2"
                  type="button"
                  onClick={() => {
                    setErrors({});
                    setSubmitError('');
                    setStep((current) => Math.max(0, current - 1));
                  }}
                  disabled={step === 0 || submitting}
                >
                  <ArrowLeft aria-hidden="true" size={16} /> Back
                </button>
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                  {submitError && (
                    <p className="max-w-sm text-sm text-red-600 dark:text-red-400" role="alert">
                      {submitError}
                    </p>
                  )}
                  <button className="button gap-2" type="submit" disabled={submitting}>
                    {step === steps.length - 1 ? (
                      submitting ? (
                        'Creating workspace...'
                      ) : (
                        <>
                          <ShieldCheck aria-hidden="true" size={17} /> Complete setup
                        </>
                      )
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight aria-hidden="true" size={16} />
                      </>
                    )}
                  </button>
                </div>
              </footer>
            </form>
          </div>
          <p className="mt-5 text-center text-xs text-slate-400">
            Setup closes permanently after the first account is created.
          </p>
        </div>
      </section>
    </main>
  );
}

function Field({
  children,
  error,
  label,
  name,
  wide = false,
}: {
  children: ReactNode;
  error?: string;
  label: string;
  name: FieldName;
  wide?: boolean;
}) {
  return (
    <label className={`block text-sm font-medium ${wide ? 'sm:col-span-2' : ''}`} htmlFor={name}>
      {label}
      {children}
      {error && (
        <span
          id={`${name}-error`}
          className="mt-2 block text-xs font-normal text-red-600 dark:text-red-400"
        >
          {error}
        </span>
      )}
    </label>
  );
}

function ReviewCard({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-background p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      <dl className="mt-4 space-y-3">{children}</dl>
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3 text-sm">
      <dt className="text-slate-400">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{value}</dd>
    </div>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63)
    .replace(/-$/, '');
}
