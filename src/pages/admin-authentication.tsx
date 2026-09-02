import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Chrome,
  Clipboard,
  ExternalLink,
  KeyRound,
  Loader2,
  MessageSquare,
  PanelsTopLeft,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { Layout } from '@/components/layout';
import { useApi } from '@/hooks/use-api';

type ProviderType = 'GOOGLE' | 'MICROSOFT' | 'SLACK' | 'ACTIVE_DIRECTORY';

type AuthProvider = {
  id: string;
  type: ProviderType;
  displayName: string;
  clientId: string;
  tenantId: string | null;
  domainHint: string | null;
  enabled: boolean;
  updatedAt: string;
};

type AuthProviderData = {
  providers: AuthProvider[];
  passwordLoginEnabled: boolean;
  callbackUrl: string;
};

type ProviderForm = {
  displayName: string;
  clientId: string;
  clientSecret: string;
  tenantId: string;
  domainHint: string;
  enabled: boolean;
};

type ProviderDefinition = {
  type: ProviderType;
  name: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
  callbackProvider: 'google' | 'microsoft' | 'slack';
  consoleUrl: string;
  consoleLabel: string;
  instructions: readonly string[];
  requiresTenant: boolean;
  showsDomainHint: boolean;
  domainHintHelp?: string;
};

const providerDefinitions: readonly ProviderDefinition[] = [
  {
    type: 'GOOGLE',
    name: 'Google Workspace',
    subtitle: 'Google OAuth 2.0',
    description: 'Let people sign in with managed Google Workspace accounts.',
    icon: Chrome,
    iconClassName: 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300',
    callbackProvider: 'google',
    consoleUrl: 'https://console.cloud.google.com/apis/credentials',
    consoleLabel: 'Google Cloud Console',
    instructions: [
      'Create an OAuth 2.0 client ID for a Web application in Google Cloud Console.',
      'Configure the OAuth consent screen for your organization and request openid, profile, and email scopes.',
      'Add the callback URL below as an authorized redirect URI, then paste the client credentials here.',
    ],
    requiresTenant: false,
    showsDomainHint: true,
    domainHintHelp: 'Optionally suggest your Workspace domain on the Google sign-in screen.',
  },
  {
    type: 'MICROSOFT',
    name: 'Microsoft',
    subtitle: 'Microsoft Entra ID',
    description: 'Connect Microsoft work, school, or personal identities through Entra ID.',
    icon: PanelsTopLeft,
    iconClassName: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
    callbackProvider: 'microsoft',
    consoleUrl:
      'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    consoleLabel: 'Microsoft Entra admin center',
    instructions: [
      'Create an app registration in Microsoft Entra ID and choose the supported account type your organization needs.',
      'Under Authentication, add a Web platform and use the callback URL below as its redirect URI.',
      'Create a client secret, then copy its value and your Directory (tenant) ID before leaving Entra.',
    ],
    requiresTenant: true,
    showsDomainHint: false,
  },
  {
    type: 'SLACK',
    name: 'Slack',
    subtitle: 'Sign in with Slack',
    description: 'Use Slack OpenID Connect for a familiar team sign-in experience.',
    icon: MessageSquare,
    iconClassName: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-300',
    callbackProvider: 'slack',
    consoleUrl: 'https://api.slack.com/apps',
    consoleLabel: 'Slack API dashboard',
    instructions: [
      'Create or select an app in the Slack API dashboard and enable Sign in with Slack.',
      'Add the callback URL below under OAuth & Permissions as a redirect URL.',
      'Use the OpenID scopes openid, profile, and email, then copy the client ID and secret here.',
    ],
    requiresTenant: false,
    showsDomainHint: false,
  },
  {
    type: 'ACTIVE_DIRECTORY',
    name: 'Active Directory',
    subtitle: 'Via Microsoft Entra ID',
    description: 'Federate your Active Directory tenant through Microsoft Entra ID.',
    icon: Building2,
    iconClassName: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
    callbackProvider: 'microsoft',
    consoleUrl:
      'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    consoleLabel: 'Microsoft Entra admin center',
    instructions: [
      'Register a single-tenant Web application in Microsoft Entra ID for your Active Directory tenant.',
      'Add the callback URL below as the Web redirect URI and create a client secret for the application.',
      'Enter the Directory (tenant) ID and, if useful, your verified domain to streamline account discovery.',
    ],
    requiresTenant: true,
    showsDomainHint: true,
    domainHintHelp: 'Optionally suggest your verified Entra domain during account discovery.',
  },
] as const;

export default function AdminAuthentication() {
  const authProviders = useApi<AuthProviderData>('/api/v1/admin/auth-providers');
  const [selectedType, setSelectedType] = useState<ProviderType | null>(null);
  const [form, setForm] = useState<ProviderForm>(emptyForm(''));
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [copiedCallback, setCopiedCallback] = useState(false);

  const selectedDefinition = providerDefinitions.find(
    (definition) => definition.type === selectedType,
  );
  const selectedProvider = authProviders.data?.providers.find(
    (provider) => provider.type === selectedType,
  );

  function selectProvider(type: ProviderType) {
    const definition = providerDefinitions.find((item) => item.type === type);
    if (!definition) return;
    const existing = authProviders.data?.providers.find((provider) => provider.type === type);
    setSelectedType(type);
    setForm(existing ? formFromProvider(existing) : emptyForm(definition.name));
    setActionError('');
    setSuccessMessage('');
    setCopiedCallback(false);
    window.setTimeout(() => document.getElementById('provider-setup')?.scrollIntoView(), 0);
  }

  async function saveProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDefinition) return;

    setSaving(true);
    setActionError('');
    setSuccessMessage('');
    try {
      const response = await fetch('/api/v1/admin/auth-providers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: selectedDefinition.type,
          displayName: form.displayName.trim(),
          clientId: form.clientId.trim(),
          ...(form.clientSecret ? { clientSecret: form.clientSecret } : {}),
          ...(selectedDefinition.requiresTenant ? { tenantId: form.tenantId.trim() } : {}),
          ...(selectedDefinition.showsDomainHint ? { domainHint: form.domainHint.trim() } : {}),
          enabled: form.enabled,
        }),
      });
      const body = (await response.json()) as {
        data?: AuthProvider;
        error?: { message?: string };
      };
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message ?? `Unable to save ${selectedDefinition.name}.`);
      }

      const savedProvider = body.data;
      authProviders.setData((current) => {
        if (!current) return current;
        const providers = current.providers
          .filter((provider) => provider.id !== savedProvider.id)
          .map((provider) => (savedProvider.enabled ? { ...provider, enabled: false } : provider));
        providers.push(savedProvider);
        providers.sort((left, right) => left.type.localeCompare(right.type));
        return {
          ...current,
          providers,
          passwordLoginEnabled: !providers.some((provider) => provider.enabled),
        };
      });
      setForm(formFromProvider(savedProvider));
      setSuccessMessage(
        savedProvider.enabled
          ? `${savedProvider.displayName} is active. Email and password login is now disabled.`
          : `${savedProvider.displayName} was saved without being activated.`,
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to save the SSO provider.');
    } finally {
      setSaving(false);
    }
  }

  async function removeProvider(provider: AuthProvider) {
    if (
      !window.confirm(
        `Remove ${provider.displayName}? People will no longer be able to use this SSO configuration.`,
      )
    )
      return;

    setRemovingId(provider.id);
    setActionError('');
    setSuccessMessage('');
    try {
      const response = await fetch(`/api/v1/admin/auth-providers/${provider.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? `Unable to remove ${provider.displayName}.`);
      }
      authProviders.setData((current) => {
        if (!current) return current;
        const providers = current.providers.filter((item) => item.id !== provider.id);
        return {
          ...current,
          providers,
          passwordLoginEnabled: !providers.some((item) => item.enabled),
        };
      });
      if (selectedType === provider.type) {
        const definition = providerDefinitions.find((item) => item.type === provider.type);
        setForm(emptyForm(definition?.name ?? ''));
      }
      setSuccessMessage(`${provider.displayName} was removed.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to remove the SSO provider.');
    } finally {
      setRemovingId(null);
    }
  }

  async function copyCallback(callbackUrl: string) {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopiedCallback(true);
    } catch {
      setActionError('Unable to copy the callback URL. Select it and copy it manually.');
    }
  }

  return (
    <Layout admin>
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">AUTHENTICATION</p>
          <h1 className="mt-2 text-3xl font-semibold">Bring your own identity provider</h1>
          <p className="mt-2 text-slate-500">
            Configure one secure sign-in method for your organization and keep credentials under
            admin control.
          </p>
        </div>
        {!authProviders.loading && authProviders.data && (
          <div
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
              authProviders.data.passwordLoginEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
            }`}
          >
            {authProviders.data.passwordLoginEnabled ? (
              <KeyRound size={18} aria-hidden="true" />
            ) : (
              <ShieldCheck size={18} aria-hidden="true" />
            )}
            <span>
              <span className="block text-xs font-medium uppercase tracking-wide opacity-70">
                Password login
              </span>
              <strong>
                {authProviders.data.passwordLoginEnabled ? 'Enabled' : 'Disabled by SSO'}
              </strong>
            </span>
          </div>
        )}
      </header>

      {authProviders.loading ? (
        <LoadingState />
      ) : authProviders.error ? (
        <div
          className="mt-8 max-w-3xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          role="alert"
        >
          {authProviders.error}
        </div>
      ) : (
        <>
          <section className="mt-9" aria-labelledby="provider-catalog-title">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 id="provider-catalog-title" className="text-xl font-semibold">
                  Choose an identity provider
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Configure multiple providers safely, then activate one when you are ready.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {providerDefinitions.map((definition) => {
                const configured = authProviders.data?.providers.find(
                  (provider) => provider.type === definition.type,
                );
                const Icon = definition.icon;
                const selected = selectedType === definition.type;
                return (
                  <button
                    key={definition.type}
                    type="button"
                    aria-pressed={selected}
                    className={`card group relative min-h-[190px] p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md ${
                      selected ? 'border-primary ring-2 ring-primary/15' : ''
                    }`}
                    onClick={() => selectProvider(definition.type)}
                  >
                    <span
                      className={`grid h-11 w-11 place-items-center rounded-xl ${definition.iconClassName}`}
                    >
                      <Icon size={21} aria-hidden="true" />
                    </span>
                    {configured && (
                      <span
                        className={`absolute right-4 top-4 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
                          configured.enabled
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-muted text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {configured.enabled && <Check size={12} aria-hidden="true" />}
                        {configured.enabled ? 'Active' : 'Configured'}
                      </span>
                    )}
                    <span className="mt-5 block font-semibold">{definition.name}</span>
                    <span className="mt-0.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
                      {definition.subtitle}
                    </span>
                    <span className="mt-3 block text-sm leading-5 text-slate-500">
                      {definition.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {selectedDefinition && (
            <section
              id="provider-setup"
              className="mt-8 grid scroll-mt-20 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
              aria-labelledby="provider-setup-title"
            >
              <form className="card overflow-hidden" onSubmit={saveProvider}>
                <div className="border-b border-border bg-muted/40 p-5 sm:p-7">
                  <div className="flex items-center gap-4">
                    <span
                      className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${selectedDefinition.iconClassName}`}
                    >
                      <selectedDefinition.icon size={23} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">
                        {selectedProvider ? 'Edit configuration' : 'New configuration'}
                      </p>
                      <h2 id="provider-setup-title" className="mt-1 text-xl font-semibold">
                        {selectedDefinition.name}
                      </h2>
                    </div>
                  </div>
                </div>

                <div className="p-5 sm:p-7">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium" htmlFor="display-name">
                        Display name
                      </label>
                      <input
                        id="display-name"
                        className="input mt-2"
                        value={form.displayName}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, displayName: event.target.value }))
                        }
                        minLength={2}
                        maxLength={60}
                        autoComplete="off"
                        required
                      />
                      <p className="mt-1.5 text-xs text-slate-500">
                        Shown to people on your organization sign-in page.
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium" htmlFor="client-id">
                        Client ID
                      </label>
                      <input
                        id="client-id"
                        className="input mt-2 font-mono"
                        value={form.clientId}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, clientId: event.target.value }))
                        }
                        minLength={3}
                        maxLength={500}
                        autoComplete="off"
                        spellCheck={false}
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium" htmlFor="client-secret">
                        Client secret
                        {selectedProvider && (
                          <span className="ml-2 font-normal text-slate-400">Stored securely</span>
                        )}
                      </label>
                      <input
                        id="client-secret"
                        className="input mt-2 font-mono"
                        type="password"
                        value={form.clientSecret}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, clientSecret: event.target.value }))
                        }
                        minLength={8}
                        maxLength={2000}
                        autoComplete="new-password"
                        placeholder={
                          selectedProvider
                            ? 'Leave blank to keep the stored secret'
                            : 'Enter secret'
                        }
                        required={!selectedProvider}
                      />
                      {selectedProvider && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                          <ShieldCheck size={13} aria-hidden="true" />
                          Stored secrets are never returned or displayed. Enter a value only to
                          rotate it.
                        </p>
                      )}
                    </div>

                    {selectedDefinition.requiresTenant && (
                      <div className={selectedDefinition.showsDomainHint ? '' : 'sm:col-span-2'}>
                        <label className="block text-sm font-medium" htmlFor="tenant-id">
                          Tenant ID
                        </label>
                        <input
                          id="tenant-id"
                          className="input mt-2 font-mono"
                          value={form.tenantId}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, tenantId: event.target.value }))
                          }
                          maxLength={200}
                          autoComplete="off"
                          placeholder="Directory (tenant) ID"
                          spellCheck={false}
                          required
                        />
                      </div>
                    )}

                    {selectedDefinition.showsDomainHint && (
                      <div className={selectedDefinition.requiresTenant ? '' : 'sm:col-span-2'}>
                        <label className="block text-sm font-medium" htmlFor="domain-hint">
                          Domain hint <span className="font-normal text-slate-400">Optional</span>
                        </label>
                        <input
                          id="domain-hint"
                          className="input mt-2"
                          value={form.domainHint}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, domainHint: event.target.value }))
                          }
                          maxLength={255}
                          autoComplete="off"
                          placeholder="example.com"
                          spellCheck={false}
                        />
                        <p className="mt-1.5 text-xs text-slate-500">
                          {selectedDefinition.domainHintHelp}
                        </p>
                      </div>
                    )}
                  </div>

                  <div
                    className={`mt-7 rounded-xl border p-4 ${
                      form.enabled
                        ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50'
                        : 'border-border bg-muted/35'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <label className="font-semibold" htmlFor="provider-enabled">
                          Activate SSO
                        </label>
                        <p className="mt-1 text-sm text-slate-500">
                          Save this configuration as your organization&apos;s sign-in method.
                        </p>
                      </div>
                      <button
                        id="provider-enabled"
                        type="button"
                        role="switch"
                        aria-checked={form.enabled}
                        aria-describedby="activation-warning"
                        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition ${
                          form.enabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                        onClick={() =>
                          setForm((current) => ({ ...current, enabled: !current.enabled }))
                        }
                      >
                        <span
                          className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                            form.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                        <span className="sr-only">
                          {form.enabled ? 'Deactivate provider' : 'Activate provider'}
                        </span>
                      </button>
                    </div>
                    {form.enabled && (
                      <div
                        id="activation-warning"
                        className="mt-4 flex gap-3 border-t border-amber-200 pt-4 text-sm font-medium leading-5 text-amber-900 dark:border-amber-800 dark:text-amber-200"
                      >
                        <AlertTriangle className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
                        <p>
                          Activating this provider immediately disables email and password login for
                          everyone in the organization. Verify these credentials and preserve an
                          admin recovery path before saving.
                        </p>
                      </div>
                    )}
                  </div>

                  {(actionError || successMessage) && (
                    <div
                      className={`mt-5 flex items-start gap-2 rounded-lg p-3 text-sm ${
                        actionError
                          ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                      role={actionError ? 'alert' : 'status'}
                    >
                      {!actionError && (
                        <CheckCircle2 className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
                      )}
                      {actionError || successMessage}
                    </div>
                  )}

                  <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      {selectedProvider
                        ? `Last updated ${formatDate(selectedProvider.updatedAt)}`
                        : 'The secret is encrypted before it is stored.'}
                    </p>
                    <button className="button min-w-[160px] gap-2" type="submit" disabled={saving}>
                      {saving && <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
                      {saving
                        ? 'Saving...'
                        : form.enabled
                          ? 'Save and activate SSO'
                          : 'Save configuration'}
                    </button>
                  </div>
                </div>
              </form>

              <aside className="card h-fit overflow-hidden xl:sticky xl:top-20">
                <div className="border-b border-border p-5">
                  <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">
                    Setup guide
                  </p>
                  <h2 className="mt-1 font-semibold">Configure {selectedDefinition.name}</h2>
                </div>
                <div className="p-5">
                  <ol className="space-y-4">
                    {selectedDefinition.instructions.map((instruction, index) => (
                      <li
                        key={instruction}
                        className="flex gap-3 text-sm leading-5 text-slate-600 dark:text-slate-300"
                      >
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {index + 1}
                        </span>
                        <span>{instruction}</span>
                      </li>
                    ))}
                  </ol>

                  <a
                    className="button-secondary mt-5 w-full gap-2"
                    href={selectedDefinition.consoleUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open {selectedDefinition.consoleLabel}
                    <ExternalLink size={15} aria-hidden="true" />
                  </a>

                  <div className="mt-6 border-t border-border pt-5">
                    <label
                      className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500"
                      htmlFor="callback-url"
                    >
                      Callback URL
                    </label>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Add this exact URL to the provider&apos;s authorized redirect URLs.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <input
                        id="callback-url"
                        className="input min-w-0 font-mono text-xs"
                        value={callbackFor(authProviders.data?.callbackUrl, selectedDefinition)}
                        readOnly
                        onFocus={(event) => event.currentTarget.select()}
                      />
                      <button
                        className="button-secondary w-11 shrink-0 !px-0"
                        type="button"
                        aria-label="Copy callback URL"
                        onClick={() =>
                          copyCallback(
                            callbackFor(authProviders.data?.callbackUrl, selectedDefinition),
                          )
                        }
                      >
                        {copiedCallback ? (
                          <Check size={16} aria-hidden="true" />
                        ) : (
                          <Clipboard size={16} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <p className="mt-2 min-h-[1rem] text-xs text-emerald-600" aria-live="polite">
                      {copiedCallback ? 'Callback URL copied.' : ''}
                    </p>
                  </div>
                </div>
              </aside>
            </section>
          )}

          <section className="mt-10" aria-labelledby="configured-providers-title">
            <div>
              <h2 id="configured-providers-title" className="text-xl font-semibold">
                Configured providers
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Secrets remain encrypted and are never included in configuration responses.
              </p>
            </div>

            {authProviders.data?.providers.length ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {authProviders.data.providers.map((provider) => {
                  const definition = providerDefinitions.find(
                    (item) => item.type === provider.type,
                  );
                  if (!definition) return null;
                  const Icon = definition.icon;
                  return (
                    <article key={provider.id} className="card p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${definition.iconClassName}`}
                          >
                            <Icon size={19} aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold">{provider.displayName}</h3>
                            <p className="text-xs text-slate-500">{definition.name}</p>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            provider.enabled
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-muted text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {provider.enabled ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <dl className="mt-5 grid gap-3 rounded-xl bg-muted/45 p-4 text-sm sm:grid-cols-2">
                        <div className="min-w-0 sm:col-span-2">
                          <dt className="text-xs text-slate-500">Client ID</dt>
                          <dd className="mt-1 truncate font-mono text-xs" title={provider.clientId}>
                            {provider.clientId}
                          </dd>
                        </div>
                        {provider.tenantId && (
                          <div className="min-w-0">
                            <dt className="text-xs text-slate-500">Tenant ID</dt>
                            <dd
                              className="mt-1 truncate font-mono text-xs"
                              title={provider.tenantId}
                            >
                              {provider.tenantId}
                            </dd>
                          </div>
                        )}
                        {provider.domainHint && (
                          <div className="min-w-0">
                            <dt className="text-xs text-slate-500">Domain hint</dt>
                            <dd className="mt-1 truncate">{provider.domainHint}</dd>
                          </div>
                        )}
                      </dl>
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-400">
                          Updated {formatDate(provider.updatedAt)}
                        </p>
                        <div className="flex gap-2">
                          <button
                            className="button-secondary !min-h-[36px]"
                            type="button"
                            onClick={() => selectProvider(provider.type)}
                          >
                            Edit
                          </button>
                          <button
                            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                            type="button"
                            disabled={removingId === provider.id}
                            onClick={() => removeProvider(provider)}
                          >
                            {removingId === provider.id ? (
                              <Loader2 className="animate-spin" size={15} aria-hidden="true" />
                            ) : (
                              <Trash2 size={15} aria-hidden="true" />
                            )}
                            Remove
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="card mt-4 flex flex-col items-center px-6 py-10 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-slate-400">
                  <KeyRound size={21} aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold">No SSO providers configured</h3>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  Choose a provider above to prepare your first organization sign-in connection.
                </p>
              </div>
            )}

            {!selectedDefinition && (actionError || successMessage) && (
              <div
                className={`mt-4 rounded-lg p-3 text-sm ${
                  actionError
                    ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                }`}
                role={actionError ? 'alert' : 'status'}
              >
                {actionError || successMessage}
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}

function emptyForm(displayName: string): ProviderForm {
  return {
    displayName,
    clientId: '',
    clientSecret: '',
    tenantId: '',
    domainHint: '',
    enabled: false,
  };
}

function formFromProvider(provider: AuthProvider): ProviderForm {
  return {
    displayName: provider.displayName,
    clientId: provider.clientId,
    clientSecret: '',
    tenantId: provider.tenantId ?? '',
    domainHint: provider.domainHint ?? '',
    enabled: provider.enabled,
  };
}

function callbackFor(template: string | undefined, definition: ProviderDefinition): string {
  return (template ?? '').replace('{provider}', definition.callbackProvider);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function LoadingState() {
  return (
    <div className="mt-9" aria-label="Loading authentication providers" role="status">
      <span className="sr-only">Loading authentication providers</span>
      <div className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="card h-[190px] p-5">
            <div className="h-11 w-11 rounded-xl bg-muted" />
            <div className="mt-5 h-4 w-28 rounded bg-muted" />
            <div className="mt-4 h-3 rounded bg-muted" />
            <div className="mt-2 h-3 w-4/5 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
