import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Box,
  Check,
  CheckCircle2,
  Cloud,
  Code2,
  ExternalLink,
  FileText,
  Github,
  KeyRound,
  Link2,
  MessageSquare,
  Plus,
  ShieldCheck,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { Layout } from '@/components/layout';
import { useApi } from '@/hooks/use-api';

type ApplicationType = 'LINK' | 'LOCAL' | 'OIDC' | 'SAML';
type TemplateId = 'github' | 'grafana' | 'notion' | 'slack' | 'salesforce' | 'custom';

type Application = {
  id: string;
  name: string;
  description?: string | null;
  type: ApplicationType;
  launchUrl?: string | null;
  redirectUris?: string[];
  scopes?: string[];
  isPublished: boolean;
  clientId?: string | null;
};

type WizardForm = {
  templateId: TemplateId | null;
  name: string;
  description: string;
  type: ApplicationType;
  launchUrl: string;
  redirectUris: string[];
  scopes: string;
  isPublished: boolean;
};

type FieldName = 'template' | 'name' | 'description' | 'launchUrl' | 'redirectUris' | 'scopes';
type FieldErrors = Partial<Record<FieldName, string>>;

type ApplicationTemplate = {
  id: TemplateId;
  name: string;
  description: string;
  icon: LucideIcon;
  type: ApplicationType;
  launchUrl: string;
  appName: string;
};

const templates: ApplicationTemplate[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Connect repositories and developer workflows with OpenID Connect.',
    icon: Github,
    type: 'OIDC',
    launchUrl: 'https://github.com',
    appName: 'GitHub',
  },
  {
    id: 'grafana',
    name: 'Grafana',
    description: 'Add your internally hosted observability workspace.',
    icon: BarChart3,
    type: 'LOCAL',
    launchUrl: '',
    appName: 'Grafana',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Give teams a managed link to their shared knowledge base.',
    icon: FileText,
    type: 'LINK',
    launchUrl: 'https://www.notion.so',
    appName: 'Notion',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Configure an OpenID Connect entry point for team communication.',
    icon: MessageSquare,
    type: 'OIDC',
    launchUrl: 'https://app.slack.com',
    appName: 'Slack',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Prepare a SAML-backed connection to your Salesforce organization.',
    icon: Cloud,
    type: 'SAML',
    launchUrl: 'https://login.salesforce.com',
    appName: 'Salesforce',
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Start with a clean integration and choose the connection method.',
    icon: Wrench,
    type: 'LINK',
    launchUrl: '',
    appName: 'Custom application',
  },
];

const steps = ['Template', 'Details', 'Connection', 'Access', 'Review'] as const;

const initialForm: WizardForm = {
  templateId: null,
  name: '',
  description: '',
  type: 'LINK',
  launchUrl: '',
  redirectUris: [''],
  scopes: 'openid profile email',
  isPublished: false,
};

export default function AdminApplications() {
  const applications = useApi<Application[]>('/api/v1/applications?admin=true');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Application | null>(null);

  function openWizard() {
    setWizardOpen(true);
    setStep(0);
    setForm(initialForm);
    setErrors({});
    setSubmitError('');
    setCreated(null);
  }

  function closeWizard() {
    setWizardOpen(false);
    setCreated(null);
    setSubmitError('');
  }

  async function updateApplication(application: Application, action: 'toggle' | 'delete') {
    if (
      action === 'delete' &&
      !window.confirm(`Delete ${application.name} and all of its assignments?`)
    )
      return;
    const response = await fetch(
      `/api/v1/applications/${application.id}`,
      action === 'delete'
        ? { method: 'DELETE' }
        : {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ isPublished: !application.isPublished }),
          },
    );
    if (!response.ok) {
      setSubmitError('Unable to update the integration.');
      return;
    }
    applications.setData((current) =>
      action === 'delete'
        ? current?.filter((item) => item.id !== application.id)
        : current?.map((item) =>
            item.id === application.id ? { ...item, isPublished: !item.isPublished } : item,
          ),
    );
  }

  function chooseTemplate(template: ApplicationTemplate) {
    setForm({
      ...initialForm,
      templateId: template.id,
      name: template.appName,
      description: template.id === 'custom' ? '' : template.description,
      type: template.type,
      launchUrl: template.launchUrl,
    });
    setErrors({});
  }

  function nextStep() {
    const nextErrors = validateStep(step, form);
    setErrors(nextErrors);
    setSubmitError('');
    if (Object.keys(nextErrors).length) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function previousStep() {
    setErrors({});
    setSubmitError('');
    setStep((current) => Math.max(current - 1, 0));
  }

  async function createApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < steps.length - 1) {
      nextStep();
      return;
    }

    const allErrors = validateAll(form);
    setErrors(allErrors);
    setSubmitError('');
    if (Object.keys(allErrors).length) {
      setStep(firstInvalidStep(allErrors));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/applications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          type: form.type,
          launchUrl: form.launchUrl.trim(),
          redirectUris:
            form.type === 'OIDC' ? form.redirectUris.map((uri) => uri.trim()).filter(Boolean) : [],
          scopes: form.type === 'OIDC' ? parseScopes(form.scopes) : [],
          isPublished: form.isPublished,
        }),
      });
      const body = (await response.json()) as {
        data?: Application;
        error?: { message?: string };
      };
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message ?? 'Unable to create the integration.');
      }

      setCreated(body.data);
      if (body.data.isPublished) {
        applications.setData(
          [...(applications.data ?? []), body.data].sort((left, right) =>
            left.name.localeCompare(right.name),
          ),
        );
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to create the integration.');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedTemplate = templates.find((template) => template.id === form.templateId);

  return (
    <Layout admin>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">APPLICATION INTEGRATIONS</p>
          <h1 className="mt-2 text-3xl font-semibold">Connect the tools your team uses</h1>
          <p className="mt-2 text-slate-500">
            Configure secure launch points, identity connections, and marketplace visibility.
          </p>
        </div>
        <button className="button shrink-0 gap-2" type="button" onClick={openWizard}>
          <Plus size={17} /> Add integration
        </button>
      </header>

      {wizardOpen && (
        <section className="card mt-8 overflow-hidden" aria-labelledby="wizard-title">
          <div className="border-b border-border bg-muted/40 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">
                  New application
                </p>
                <h2 id="wizard-title" className="mt-1 text-xl font-semibold">
                  {created ? 'Integration created' : steps[step]}
                </h2>
              </div>
              <button
                aria-label="Close application wizard"
                className="button-secondary !min-h-[36px] !px-2.5"
                type="button"
                onClick={closeWizard}
              >
                <X size={17} />
              </button>
            </div>

            {!created && (
              <div className="mt-6">
                <ol className="grid grid-cols-5 gap-1" aria-label="Application setup progress">
                  {steps.map((label, index) => (
                    <li
                      key={label}
                      className={`flex min-w-0 items-center gap-2 text-xs font-medium ${
                        index <= step ? 'text-primary' : 'text-slate-400'
                      }`}
                      aria-current={index === step ? 'step' : undefined}
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${
                          index < step
                            ? 'border-primary bg-primary text-white'
                            : index === step
                              ? 'border-primary bg-card'
                              : 'border-border bg-card'
                        }`}
                      >
                        {index < step ? <Check size={14} /> : index + 1}
                      </span>
                      <span className="hidden truncate md:block">{label}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${((step + 1) / steps.length) * 100}%` }}
                  />
                </div>
                <p className="sr-only" aria-live="polite">
                  Step {step + 1} of {steps.length}: {steps[step]}
                </p>
              </div>
            )}
          </div>

          {created ? (
            <SuccessPanel application={created} onAnother={openWizard} onClose={closeWizard} />
          ) : (
            <form onSubmit={createApplication} noValidate>
              <div className="min-h-[390px] p-5 sm:p-8">
                {Object.keys(errors).length > 0 && (
                  <div
                    className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                    role="alert"
                  >
                    Check the highlighted fields before continuing.
                  </div>
                )}
                {step === 0 && (
                  <TemplateStep selected={form.templateId} onSelect={chooseTemplate} />
                )}
                {step === 1 && <DetailsStep form={form} setForm={setForm} errors={errors} />}
                {step === 2 && <ConnectionStep form={form} setForm={setForm} errors={errors} />}
                {step === 3 && <AccessStep form={form} setForm={setForm} />}
                {step === 4 && (
                  <ReviewStep form={form} selectedTemplate={selectedTemplate ?? templates[5]} />
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <button
                  className="button-secondary gap-2"
                  type="button"
                  onClick={previousStep}
                  disabled={step === 0 || submitting}
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                  {submitError && (
                    <p className="max-w-md text-sm text-red-600 dark:text-red-400" role="alert">
                      {submitError}
                    </p>
                  )}
                  <button className="button gap-2" type="submit" disabled={submitting}>
                    {step === steps.length - 1 ? (
                      submitting ? (
                        'Creating...'
                      ) : (
                        <>
                          Create integration <CheckCircle2 size={16} />
                        </>
                      )
                    ) : (
                      <>
                        Continue <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>
      )}

      <section className="mt-10" aria-labelledby="catalog-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="catalog-title" className="text-xl font-semibold">
              Managed integrations
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Configure marketplace visibility or remove applications from your organization.
            </p>
          </div>
          {!applications.loading && !applications.error && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-slate-500">
              {applications.data?.length ?? 0} total
            </span>
          )}
        </div>

        {applications.loading ? (
          <div
            className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
            aria-label="Loading integrations"
          >
            {[1, 2, 3].map((item) => (
              <div className="card h-52 animate-pulse bg-muted" key={item} />
            ))}
          </div>
        ) : applications.error ? (
          <div
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            role="alert"
          >
            {applications.error || 'Unable to load integrations.'}
          </div>
        ) : applications.data?.length ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {applications.data.map((application) => (
              <ApplicationCard
                application={application}
                key={application.id}
                onAction={updateApplication}
              />
            ))}
          </div>
        ) : (
          <div className="card mt-6 border-dashed p-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-muted text-primary">
              <Box size={21} />
            </span>
            <h3 className="mt-4 font-semibold">No published integrations yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Add an application and publish it when you are ready for members to discover it.
            </p>
            <button className="button-secondary mt-5 gap-2" type="button" onClick={openWizard}>
              <Plus size={16} /> Add your first integration
            </button>
          </div>
        )}
      </section>
    </Layout>
  );
}

function TemplateStep({
  selected,
  onSelect,
}: {
  selected: TemplateId | null;
  onSelect: (template: ApplicationTemplate) => void;
}) {
  return (
    <fieldset>
      <legend className="text-lg font-semibold">Choose a starting point</legend>
      <p className="mt-1 text-sm text-slate-500">
        Templates prefill sensible details. You can adjust the connection method later.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => {
          const Icon = template.icon;
          const active = selected === template.id;
          return (
            <label
              key={template.id}
              className={`relative cursor-pointer rounded-xl border p-4 transition hover:border-primary ${
                active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card'
              }`}
            >
              <input
                className="sr-only"
                type="radio"
                name="application-template"
                value={template.id}
                checked={active}
                onChange={() => onSelect(template)}
              />
              <span className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-primary">
                  <Icon size={20} />
                </span>
                {active && (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-white">
                    <Check size={14} />
                  </span>
                )}
              </span>
              <span className="mt-4 block font-semibold">{template.name}</span>
              <span className="mt-1 block text-sm leading-5 text-slate-500">
                {template.description}
              </span>
              <span className="mt-3 inline-block rounded-md bg-muted px-2 py-1 text-xs font-semibold text-slate-500">
                {typeLabel(template.type)}
              </span>
            </label>
          );
        })}
      </div>
      {!selected && <p className="mt-4 text-sm text-slate-500">Select one template to continue.</p>}
    </fieldset>
  );
}

function DetailsStep({
  form,
  setForm,
  errors,
}: {
  form: WizardForm;
  setForm: (form: WizardForm) => void;
  errors: FieldErrors;
}) {
  return (
    <div className="max-w-2xl">
      <h3 className="text-lg font-semibold">Basic details</h3>
      <p className="mt-1 text-sm text-slate-500">
        Use a clear name and description so members can identify the application.
      </p>

      <label className="mt-6 block text-sm font-medium" htmlFor="application-name">
        Application name
      </label>
      <input
        id="application-name"
        className="input mt-2"
        value={form.name}
        onChange={(event) => setForm({ ...form, name: event.target.value })}
        aria-invalid={Boolean(errors.name)}
        aria-describedby={errors.name ? 'application-name-error' : undefined}
        maxLength={80}
        autoComplete="off"
      />
      <FieldError id="application-name-error" message={errors.name} />

      <div className="mt-5 flex items-center justify-between gap-3">
        <label className="text-sm font-medium" htmlFor="application-description">
          Description <span className="font-normal text-slate-400">Optional</span>
        </label>
        <span className="text-xs text-slate-400">{form.description.length}/500</span>
      </div>
      <textarea
        id="application-description"
        className="input mt-2 min-h-[120px] resize-y py-3"
        value={form.description}
        onChange={(event) => setForm({ ...form, description: event.target.value })}
        aria-invalid={Boolean(errors.description)}
        aria-describedby={errors.description ? 'application-description-error' : undefined}
        maxLength={500}
        placeholder="What this application helps your team accomplish"
      />
      <FieldError id="application-description-error" message={errors.description} />
    </div>
  );
}

function ConnectionStep({
  form,
  setForm,
  errors,
}: {
  form: WizardForm;
  setForm: (form: WizardForm) => void;
  errors: FieldErrors;
}) {
  const connectionTypes: {
    type: ApplicationType;
    title: string;
    detail: string;
    icon: LucideIcon;
  }[] = [
    { type: 'LINK', title: 'Link', detail: 'Managed external link', icon: Link2 },
    { type: 'LOCAL', title: 'Local', detail: 'Internally hosted app', icon: Code2 },
    { type: 'OIDC', title: 'OIDC', detail: 'OpenID Connect', icon: KeyRound },
    { type: 'SAML', title: 'SAML', detail: 'SAML 2.0 launch', icon: ShieldCheck },
  ];

  function updateRedirectUri(index: number, value: string) {
    setForm({
      ...form,
      redirectUris: form.redirectUris.map((uri, uriIndex) => (uriIndex === index ? value : uri)),
    });
  }

  return (
    <div>
      <fieldset>
        <legend className="text-lg font-semibold">Connection method</legend>
        <p className="mt-1 text-sm text-slate-500">
          Choose how Authy should represent and launch this application.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {connectionTypes.map((connection) => {
            const Icon = connection.icon;
            const active = form.type === connection.type;
            return (
              <label
                htmlFor={`connection-${connection.type}`}
                className={`cursor-pointer rounded-xl border p-4 ${
                  active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
                }`}
                key={connection.type}
              >
                <span className="sr-only">Connection method option</span>
                <input
                  id={`connection-${connection.type}`}
                  className="sr-only"
                  type="radio"
                  name="connection-type"
                  value={connection.type}
                  checked={active}
                  onChange={() => setForm({ ...form, type: connection.type })}
                />
                <span className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-primary">
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{connection.title}</span>
                    <span className="block text-xs text-slate-500">{connection.detail}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-7 max-w-3xl border-t border-border pt-6">
        <label className="block text-sm font-medium" htmlFor="launch-url">
          Launch URL
        </label>
        <input
          id="launch-url"
          className="input mt-2"
          type="url"
          inputMode="url"
          value={form.launchUrl}
          onChange={(event) => setForm({ ...form, launchUrl: event.target.value })}
          aria-invalid={Boolean(errors.launchUrl)}
          aria-describedby={errors.launchUrl ? 'launch-url-error' : 'launch-url-help'}
          placeholder={
            form.type === 'LOCAL' ? 'https://grafana.company.example' : 'https://app.example.com'
          }
        />
        <p id="launch-url-help" className="mt-2 text-xs text-slate-500">
          The secure HTTP(S) destination members open after access is granted.
        </p>
        <FieldError id="launch-url-error" message={errors.launchUrl} />

        {form.type === 'OIDC' && (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium" htmlFor="redirect-uri-0">
                Redirect URIs
              </label>
              <button
                className="text-sm font-semibold text-primary hover:underline disabled:opacity-50"
                type="button"
                disabled={form.redirectUris.length >= 20}
                onClick={() => setForm({ ...form, redirectUris: [...form.redirectUris, ''] })}
              >
                + Add URI
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Exact callback locations registered by the relying application.
            </p>
            <div className="mt-3 space-y-3">
              {form.redirectUris.map((uri, index) => (
                <div className="flex gap-2" key={index}>
                  <input
                    id={`redirect-uri-${index}`}
                    className="input"
                    type="url"
                    inputMode="url"
                    aria-label={`Redirect URI ${index + 1}`}
                    aria-invalid={Boolean(errors.redirectUris)}
                    value={uri}
                    onChange={(event) => updateRedirectUri(index, event.target.value)}
                    placeholder="https://app.example.com/auth/callback"
                  />
                  <button
                    aria-label={`Remove redirect URI ${index + 1}`}
                    className="button-secondary !px-3"
                    type="button"
                    disabled={form.redirectUris.length === 1}
                    onClick={() =>
                      setForm({
                        ...form,
                        redirectUris: form.redirectUris.filter((_, uriIndex) => uriIndex !== index),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <FieldError id="redirect-uris-error" message={errors.redirectUris} />

            <label className="mt-6 block text-sm font-medium" htmlFor="oidc-scopes">
              Scopes
            </label>
            <input
              id="oidc-scopes"
              className="input mt-2 font-mono"
              value={form.scopes}
              onChange={(event) => setForm({ ...form, scopes: event.target.value })}
              aria-invalid={Boolean(errors.scopes)}
              aria-describedby={errors.scopes ? 'oidc-scopes-error' : 'oidc-scopes-help'}
              placeholder="openid profile email"
            />
            <p id="oidc-scopes-help" className="mt-2 text-xs text-slate-500">
              Separate scopes with spaces or commas. Start with the least access the app needs.
            </p>
            <FieldError id="oidc-scopes-error" message={errors.scopes} />
          </div>
        )}

        {form.type === 'SAML' && (
          <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-5">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={20} />
              <div>
                <h4 className="text-sm font-semibold">Plan the metadata exchange</h4>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Ask the service provider for its Entity ID, Assertion Consumer Service (ACS) URL,
                  and signing requirements. Configure those values in your identity provider, then
                  give the provider your IdP metadata URL or XML and signing certificate.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  This integration endpoint stores the launch configuration only. Complete the
                  metadata exchange with the service provider before assigning access.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AccessStep({ form, setForm }: { form: WizardForm; setForm: (form: WizardForm) => void }) {
  return (
    <div className="max-w-3xl">
      <h3 className="text-lg font-semibold">Access and publishing</h3>
      <p className="mt-1 text-sm text-slate-500">
        Decide whether members can discover this application as soon as it is created.
      </p>

      <fieldset className="mt-6 grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Marketplace visibility</legend>
        <label
          className={`cursor-pointer rounded-xl border p-5 ${
            form.isPublished ? 'border-border' : 'border-primary bg-primary/5 ring-1 ring-primary'
          }`}
        >
          <input
            className="sr-only"
            type="radio"
            name="publishing"
            checked={!form.isPublished}
            onChange={() => setForm({ ...form, isPublished: false })}
          />
          <span className="flex items-start justify-between gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-primary">
              <ShieldCheck size={19} />
            </span>
            {!form.isPublished && <CheckCircle2 className="text-primary" size={20} />}
          </span>
          <span className="mt-4 block font-semibold">Keep private</span>
          <span className="mt-1 block text-sm leading-5 text-slate-500">
            Hidden from the marketplace while administrators finish setup and assignments.
          </span>
        </label>

        <label
          className={`cursor-pointer rounded-xl border p-5 ${
            form.isPublished ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
          }`}
        >
          <input
            className="sr-only"
            type="radio"
            name="publishing"
            checked={form.isPublished}
            onChange={() => setForm({ ...form, isPublished: true })}
          />
          <span className="flex items-start justify-between gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-primary">
              <ExternalLink size={19} />
            </span>
            {form.isPublished && <CheckCircle2 className="text-primary" size={20} />}
          </span>
          <span className="mt-4 block font-semibold">Publish to marketplace</span>
          <span className="mt-1 block text-sm leading-5 text-slate-500">
            Members can discover the app and request access. Publishing does not grant access.
          </span>
        </label>
      </fieldset>

      <div className="mt-6 rounded-xl bg-muted p-4 text-sm text-slate-500">
        Access is still enforced through user or group assignments managed by an administrator.
      </div>
    </div>
  );
}

function ReviewStep({
  form,
  selectedTemplate,
}: {
  form: WizardForm;
  selectedTemplate: ApplicationTemplate;
}) {
  const Icon = selectedTemplate.icon;
  const redirectUris = form.redirectUris.map((uri) => uri.trim()).filter(Boolean);
  return (
    <div className="max-w-3xl">
      <h3 className="text-lg font-semibold">Review the integration</h3>
      <p className="mt-1 text-sm text-slate-500">Confirm these settings before creation.</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-border">
        <div className="flex items-center gap-4 border-b border-border bg-muted/40 p-5">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-white">
            <Icon size={22} />
          </span>
          <div className="min-w-0">
            <h4 className="truncate font-semibold">{form.name.trim()}</h4>
            <p className="mt-0.5 text-sm text-slate-500">
              {selectedTemplate.name} template · {typeLabel(form.type)}
            </p>
          </div>
        </div>
        <dl className="divide-y divide-border">
          <ReviewRow label="Description" value={form.description.trim() || 'No description'} />
          <ReviewRow label="Launch URL" value={form.launchUrl.trim()} mono />
          {form.type === 'OIDC' && (
            <>
              <ReviewRow label="Redirect URIs" value={redirectUris.join('\n')} mono />
              <ReviewRow label="Scopes" value={parseScopes(form.scopes).join(', ')} mono />
            </>
          )}
          <ReviewRow
            label="Visibility"
            value={form.isPublished ? 'Published to marketplace' : 'Private'}
          />
          <ReviewRow
            label="Access"
            value="Requires a user or group assignment; publishing alone does not grant access"
          />
        </dl>
      </div>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1 p-4 sm:grid-cols-[150px_1fr] sm:gap-5 sm:px-5">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className={`whitespace-pre-wrap break-words text-sm ${mono ? 'font-mono' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

function SuccessPanel({
  application,
  onAnother,
  onClose,
}: {
  application: Application;
  onAnother: () => void;
  onClose: () => void;
}) {
  return (
    <div className="p-6 sm:p-10">
      <div className="mx-auto max-w-2xl text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2 size={27} />
        </span>
        <h3 className="mt-5 text-2xl font-semibold">{application.name} is ready</h3>
        <p className="mt-2 text-sm text-slate-500">
          {application.isPublished
            ? 'It is now visible in the organization marketplace. Access still requires an assignment.'
            : 'It remains private while you finish setup and assign access.'}
        </p>

        <dl className="mt-7 overflow-hidden rounded-xl border border-border text-left">
          <ReviewRow label="Application ID" value={application.id} mono />
          <ReviewRow label="Connection" value={typeLabel(application.type)} />
          {application.type === 'OIDC' && application.clientId && (
            <ReviewRow label="OIDC client ID" value={application.clientId} mono />
          )}
        </dl>

        {application.type === 'OIDC' && application.clientId && (
          <p className="mt-3 text-left text-xs text-slate-500">
            Use this client ID in the relying application. No client secret is issued by this create
            endpoint.
          </p>
        )}

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button className="button-secondary" type="button" onClick={onClose}>
            View catalog
          </button>
          <button className="button gap-2" type="button" onClick={onAnother}>
            <Plus size={16} /> Add another
          </button>
        </div>
      </div>
    </div>
  );
}

function ApplicationCard({
  application,
  onAction,
}: {
  application: Application;
  onAction: (application: Application, action: 'toggle' | 'delete') => void;
}) {
  const Icon = applicationIcon(application);
  return (
    <article className="card group flex min-h-[210px] flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-violet-400 text-white shadow-sm">
          <Icon size={21} />
        </span>
        <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-slate-500">
          {typeLabel(application.type)}
        </span>
      </div>
      <h3 className="mt-5 font-semibold">{application.name}</h3>
      <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
        {application.description || `${typeLabel(application.type)} application integration`}
      </p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${application.isPublished ? 'bg-emerald-500' : 'bg-amber-500'}`}
          />{' '}
          {application.isPublished ? 'Published' : 'Private'}
        </span>
        <span className="flex items-center gap-2">
          <button
            className="font-medium text-primary hover:underline"
            type="button"
            onClick={() => onAction(application, 'toggle')}
          >
            {application.isPublished ? 'Unpublish' : 'Publish'}
          </button>
          <button
            className="text-red-500 hover:text-red-700"
            type="button"
            aria-label={`Delete ${application.name}`}
            onClick={() => onAction(application, 'delete')}
          >
            <Trash2 size={15} />
          </button>
        </span>
      </div>
    </article>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 text-sm text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}

function validateStep(step: number, form: WizardForm): FieldErrors {
  if (step === 0) return form.templateId ? {} : { template: 'Choose a template to continue.' };
  if (step === 1) return validateDetails(form);
  if (step === 2) return validateConnection(form);
  return {};
}

function validateAll(form: WizardForm): FieldErrors {
  return {
    ...validateStep(0, form),
    ...validateDetails(form),
    ...validateConnection(form),
  };
}

function validateDetails(form: WizardForm): FieldErrors {
  const errors: FieldErrors = {};
  const name = form.name.trim();
  if (name.length < 2) errors.name = 'Enter a name with at least 2 characters.';
  else if (name.length > 80) errors.name = 'Keep the name to 80 characters or fewer.';
  if (form.description.trim().length > 500) {
    errors.description = 'Keep the description to 500 characters or fewer.';
  }
  return errors;
}

function validateConnection(form: WizardForm): FieldErrors {
  const errors: FieldErrors = {};
  const launchUrl = form.launchUrl.trim();
  if (!launchUrl) errors.launchUrl = 'Enter the application launch URL.';
  else if (launchUrl.length > 2048 || !isHttpUrl(launchUrl)) {
    errors.launchUrl = 'Enter a valid HTTP(S) launch URL.';
  }

  if (form.type === 'OIDC') {
    const redirectUris = form.redirectUris.map((uri) => uri.trim()).filter(Boolean);
    if (!redirectUris.length) {
      errors.redirectUris = 'Add at least one redirect URI.';
    } else if (redirectUris.length > 20) {
      errors.redirectUris = 'Use no more than 20 redirect URIs.';
    } else if (redirectUris.some((uri) => uri.length > 2048 || !isHttpUrl(uri))) {
      errors.redirectUris = 'Every redirect URI must be a valid HTTP(S) URL.';
    } else if (new Set(redirectUris).size !== redirectUris.length) {
      errors.redirectUris = 'Remove duplicate redirect URIs.';
    }

    const scopes = parseScopes(form.scopes);
    if (!scopes.length) errors.scopes = 'Add at least one OIDC scope.';
    else if (scopes.length > 30) errors.scopes = 'Use no more than 30 scopes.';
    else if (scopes.some((scope) => !/^[a-z][a-z0-9:_-]*$/.test(scope))) {
      errors.scopes =
        'Scopes must start with a lowercase letter and use lowercase letters, numbers, :, _, or -.';
    } else if (new Set(scopes).size !== scopes.length) {
      errors.scopes = 'Remove duplicate scopes.';
    }
  }
  return errors;
}

function firstInvalidStep(errors: FieldErrors): number {
  if (errors.template) return 0;
  if (errors.name || errors.description) return 1;
  return 2;
}

function parseScopes(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

function typeLabel(type: ApplicationType): string {
  if (type === 'OIDC') return 'OpenID Connect';
  if (type === 'SAML') return 'SAML 2.0';
  if (type === 'LOCAL') return 'Local';
  return 'Link';
}

function applicationIcon(application: Application): LucideIcon {
  const name = application.name.toLowerCase();
  if (name.includes('github')) return Github;
  if (name.includes('grafana')) return BarChart3;
  if (name.includes('notion')) return FileText;
  if (name.includes('slack')) return MessageSquare;
  if (name.includes('salesforce')) return Cloud;
  if (application.type === 'OIDC') return KeyRound;
  if (application.type === 'SAML') return ShieldCheck;
  if (application.type === 'LINK') return Link2;
  return Box;
}
