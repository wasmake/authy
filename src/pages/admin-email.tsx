import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckCircle2,
  Code2,
  ExternalLink,
  Heading1,
  Heading2,
  Italic,
  KeyRound,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Mail,
  Pilcrow,
  Redo2,
  RotateCcw,
  Send,
  ShieldCheck,
  Underline,
  Undo2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react';

import { Layout } from '@/components/layout';
import { useApi } from '@/hooks/use-api';

type TemplateType = 'USER_CREDENTIALS' | 'PASSWORD_RESET' | 'INVITATION';

type EmailProvider = {
  id: string | null;
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  updatedAt: string | null;
  apiKeyConfigured: boolean;
};

type EmailTemplate = {
  id: string | null;
  type: TemplateType;
  label: string;
  description: string;
  subject: string;
  html: string;
  placeholders: string[];
  customized: boolean;
  updatedAt: string | null;
};

type EmailSettings = {
  provider: EmailProvider;
  templates: EmailTemplate[];
};

type ProviderDraft = {
  resendApiKey: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  enabled: boolean;
};

type Message = { kind: 'error' | 'success'; text: string } | null;
type EditorTarget = 'body' | 'source' | 'subject';

const sampleValues: Record<string, string> = {
  organizationName: 'Northstar Labs',
  recipientName: 'Jordan Lee',
  recipientEmail: 'jordan@example.com',
  appUrl: 'https://auth.example.com',
  signInUrl: 'https://auth.example.com/sign-in',
  temporaryPassword: 'harbor-orbit-maple-482917!',
  resetUrl: 'https://auth.example.com/reset-password?token=sample',
};

export default function AdminEmail() {
  const settings = useApi<EmailSettings>('/api/v1/admin/email-settings');
  const [provider, setProvider] = useState<ProviderDraft>(emptyProvider());
  const [selectedType, setSelectedType] = useState<TemplateType>('USER_CREDENTIALS');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [editorRevision, setEditorRevision] = useState(0);
  const [testRecipient, setTestRecipient] = useState('');
  const [savingProvider, setSavingProvider] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [resettingTemplate, setResettingTemplate] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [providerMessage, setProviderMessage] = useState<Message>(null);
  const [templateMessage, setTemplateMessage] = useState<Message>(null);
  const [testMessage, setTestMessage] = useState<Message>(null);

  const savedProvider = settings.data?.provider;
  const selectedTemplate = settings.data?.templates.find(
    (template) => template.type === selectedType,
  );
  const providerDirty = Boolean(
    savedProvider &&
    (provider.resendApiKey ||
      provider.fromName !== savedProvider.fromName ||
      provider.fromEmail !== savedProvider.fromEmail ||
      provider.replyTo !== (savedProvider.replyTo ?? '') ||
      provider.enabled !== savedProvider.enabled),
  );
  const templateDirty = Boolean(
    selectedTemplate && (subject !== selectedTemplate.subject || html !== selectedTemplate.html),
  );

  useEffect(() => {
    if (!settings.data?.provider) return;
    setProvider(providerFromSettings(settings.data.provider));
  }, [settings.data?.provider]);

  useEffect(() => {
    if (!settings.data?.templates.length) return;
    const nextTemplate =
      settings.data.templates.find((template) => template.type === selectedType) ??
      settings.data.templates[0];
    setSelectedType(nextTemplate.type);
    setSubject(nextTemplate.subject);
    setHtml(nextTemplate.html);
    setEditorRevision((current) => current + 1);
  }, [settings.data?.templates, selectedType]);

  useEffect(() => {
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      if (!providerDirty && !templateDirty) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [providerDirty, templateDirty]);

  function chooseTemplate(type: TemplateType) {
    if (savingTemplate || resettingTemplate) return;
    if (type === selectedType) return;
    if (
      templateDirty &&
      !window.confirm('Discard your unsaved template changes and switch to another template?')
    )
      return;

    const nextTemplate = settings.data?.templates.find((template) => template.type === type);
    if (!nextTemplate) return;
    setSelectedType(type);
    setSubject(nextTemplate.subject);
    setHtml(nextTemplate.html);
    setEditorRevision((current) => current + 1);
    setTemplateMessage(null);
    setTestMessage(null);
  }

  async function saveProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProvider(true);
    setProviderMessage(null);
    try {
      const response = await fetch('/api/v1/admin/email-settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...(provider.resendApiKey.trim() ? { resendApiKey: provider.resendApiKey.trim() } : {}),
          fromName: provider.fromName.trim(),
          fromEmail: provider.fromEmail.trim(),
          replyTo: provider.replyTo.trim(),
          enabled: provider.enabled,
        }),
      });
      const body = await readResponse<EmailProvider>(response);
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message ?? 'Unable to save email delivery settings.');
      }
      settings.setData((current) => (current ? { ...current, provider: body.data! } : current));
      setProvider(providerFromSettings(body.data));
      setProviderMessage({
        kind: 'success',
        text: body.data.enabled
          ? 'Email delivery is configured and enabled.'
          : 'Email delivery settings saved. Delivery remains paused.',
      });
    } catch (error) {
      setProviderMessage({ kind: 'error', text: errorMessage(error, 'Unable to save settings.') });
    } finally {
      setSavingProvider(false);
    }
  }

  async function saveTemplate() {
    if (!selectedTemplate) return;
    if (!subject.trim() || !html.trim()) {
      setTemplateMessage({ kind: 'error', text: 'Subject and email content are required.' });
      return;
    }
    setSavingTemplate(true);
    setTemplateMessage(null);
    try {
      const response = await fetch(
        `/api/v1/admin/email-settings/templates/${selectedTemplate.type}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ subject: subject.trim(), html }),
        },
      );
      const body = await readResponse<EmailTemplate>(response);
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message ?? 'Unable to save this email template.');
      }
      updateTemplate(body.data);
      setTemplateMessage({ kind: 'success', text: `${body.data.label} saved.` });
    } catch (error) {
      setTemplateMessage({ kind: 'error', text: errorMessage(error, 'Unable to save template.') });
    } finally {
      setSavingTemplate(false);
    }
  }

  async function resetTemplate() {
    if (!selectedTemplate) return;
    const detail = templateDirty
      ? 'This will discard your unsaved changes and restore the default template.'
      : 'This will permanently replace your customization with the default template.';
    if (!window.confirm(`${detail} Continue?`)) return;

    setResettingTemplate(true);
    setTemplateMessage(null);
    try {
      const response = await fetch(
        `/api/v1/admin/email-settings/templates/${selectedTemplate.type}`,
        { method: 'DELETE' },
      );
      const body = await readResponse<EmailTemplate>(response);
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message ?? 'Unable to restore the default template.');
      }
      updateTemplate(body.data);
      setTemplateMessage({ kind: 'success', text: 'Default template restored.' });
    } catch (error) {
      setTemplateMessage({ kind: 'error', text: errorMessage(error, 'Unable to reset template.') });
    } finally {
      setResettingTemplate(false);
    }
  }

  async function sendTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSendingTest(true);
    setTestMessage(null);
    try {
      const response = await fetch('/api/v1/admin/email-settings/test-send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: testRecipient.trim(), type: selectedType }),
      });
      const body = await readResponse<{ sent: boolean }>(response);
      if (!response.ok || !body.data?.sent) {
        throw new Error(body.error?.message ?? 'Unable to send the test email.');
      }
      setTestMessage({ kind: 'success', text: `Test email sent to ${testRecipient.trim()}.` });
    } catch (error) {
      setTestMessage({ kind: 'error', text: errorMessage(error, 'Unable to send test email.') });
    } finally {
      setSendingTest(false);
    }
  }

  function updateTemplate(template: EmailTemplate) {
    setSubject(template.subject);
    setHtml(template.html);
    setEditorRevision((current) => current + 1);
    settings.setData((current) =>
      current
        ? {
            ...current,
            templates: current.templates.map((item) =>
              item.type === template.type ? template : item,
            ),
          }
        : current,
    );
  }

  return (
    <Layout admin>
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">EMAIL DELIVERY</p>
          <h1 className="mt-2 text-3xl font-semibold">Emails that feel like your workspace</h1>
          <p className="mt-2 text-slate-500">
            Connect Resend, control delivery, and shape every transactional message your team
            receives.
          </p>
        </div>
        {!settings.loading && savedProvider && (
          <div
            className={`inline-flex w-fit items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
              savedProvider.apiKeyConfigured
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
            }`}
          >
            {savedProvider.apiKeyConfigured ? (
              <ShieldCheck size={18} aria-hidden="true" />
            ) : (
              <KeyRound size={18} aria-hidden="true" />
            )}
            <span>
              <span className="block text-xs font-medium uppercase tracking-wide opacity-70">
                Resend connection
              </span>
              <strong>{savedProvider.apiKeyConfigured ? 'Configured' : 'Setup required'}</strong>
            </span>
          </div>
        )}
      </header>

      {settings.loading ? (
        <LoadingState />
      ) : settings.error ? (
        <div
          className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          role="alert"
        >
          {settings.error}
        </div>
      ) : settings.data && selectedTemplate ? (
        <>
          <section
            className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"
            aria-labelledby="delivery-title"
          >
            <form className="card overflow-hidden" onSubmit={saveProvider}>
              <div className="flex flex-col gap-4 border-b border-border bg-muted/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Mail size={19} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 id="delivery-title" className="font-semibold">
                      Resend delivery
                    </h2>
                    <p className="text-sm text-slate-500">Sender identity and delivery controls.</p>
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-3">
                  <span className="text-sm font-medium">
                    {provider.enabled ? 'Delivery enabled' : 'Delivery paused'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={provider.enabled}
                    aria-label="Enable email delivery"
                    className={`relative h-7 w-12 rounded-full transition ${
                      provider.enabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                    onClick={() =>
                      setProvider((current) => ({ ...current, enabled: !current.enabled }))
                    }
                  >
                    <span
                      className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                        provider.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
              </div>

              <div className="p-5 sm:p-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium" htmlFor="resend-api-key">
                      Resend API key
                      {settings.data.provider.apiKeyConfigured && (
                        <span className="ml-2 font-normal text-emerald-600 dark:text-emerald-400">
                          Configured
                        </span>
                      )}
                    </label>
                    <input
                      id="resend-api-key"
                      className="input mt-2 font-mono"
                      type="password"
                      value={provider.resendApiKey}
                      onChange={(event) =>
                        setProvider((current) => ({
                          ...current,
                          resendApiKey: event.target.value,
                        }))
                      }
                      minLength={10}
                      maxLength={500}
                      autoComplete="new-password"
                      spellCheck={false}
                      required={!settings.data.provider.apiKeyConfigured}
                      placeholder={
                        settings.data.provider.apiKeyConfigured
                          ? 'Leave blank to keep the stored key'
                          : 're_...'
                      }
                    />
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <ShieldCheck size={13} aria-hidden="true" />
                      Stored keys are never returned or displayed. Enter a new key only to rotate
                      it.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium" htmlFor="from-name">
                      From name
                    </label>
                    <input
                      id="from-name"
                      className="input mt-2"
                      value={provider.fromName}
                      onChange={(event) =>
                        setProvider((current) => ({ ...current, fromName: event.target.value }))
                      }
                      minLength={1}
                      maxLength={100}
                      autoComplete="organization"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium" htmlFor="from-email">
                      From email
                    </label>
                    <input
                      id="from-email"
                      className="input mt-2"
                      type="email"
                      value={provider.fromEmail}
                      onChange={(event) =>
                        setProvider((current) => ({ ...current, fromEmail: event.target.value }))
                      }
                      maxLength={320}
                      autoComplete="email"
                      placeholder="notifications@yourdomain.com"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium" htmlFor="reply-to">
                      Reply-to address <span className="font-normal text-slate-400">Optional</span>
                    </label>
                    <input
                      id="reply-to"
                      className="input mt-2"
                      type="email"
                      value={provider.replyTo}
                      onChange={(event) =>
                        setProvider((current) => ({ ...current, replyTo: event.target.value }))
                      }
                      maxLength={320}
                      autoComplete="email"
                      placeholder="support@yourdomain.com"
                    />
                  </div>
                </div>

                <StatusMessage message={providerMessage} />
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                  {providerDirty && <UnsavedIndicator />}
                  <button
                    className="button min-w-[150px] gap-2"
                    type="submit"
                    disabled={savingProvider || !providerDirty}
                  >
                    {savingProvider && <Loader2 className="animate-spin" size={16} />}
                    {savingProvider ? 'Saving...' : 'Save delivery'}
                  </button>
                </div>
              </div>
            </form>

            <aside className="card h-fit overflow-hidden xl:sticky xl:top-20">
              <div className="border-b border-border bg-slate-950 p-6 text-white dark:bg-black">
                <p className="text-xs font-semibold uppercase tracking-[.15em] text-violet-300">
                  Resend setup
                </p>
                <h2 className="mt-2 text-xl font-semibold">Go live in three steps</h2>
              </div>
              <ol className="space-y-5 p-6 text-sm">
                <SetupStep number="1" title="Create an API key">
                  Create a sending key in{' '}
                  <ExternalAnchor href="https://resend.com/api-keys">
                    Resend API Keys
                  </ExternalAnchor>{' '}
                  and paste it here once.
                </SetupStep>
                <SetupStep number="2" title="Verify your domain">
                  Add and verify your DNS records in{' '}
                  <ExternalAnchor href="https://resend.com/domains">Resend Domains</ExternalAnchor>.
                </SetupStep>
                <SetupStep number="3" title="Use a verified sender">
                  The domain in <strong>From email</strong> must be verified in Resend.
                  Resend&apos;s testing sender is restricted and is not suitable for
                  organization-wide delivery.
                </SetupStep>
              </ol>
              <div className="border-t border-border bg-muted/30 p-5">
                <form onSubmit={sendTest}>
                  <label className="block text-sm font-medium" htmlFor="test-recipient">
                    Test recipient
                  </label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row xl:flex-col 2xl:flex-row">
                    <input
                      id="test-recipient"
                      className="input min-w-0"
                      type="email"
                      value={testRecipient}
                      onChange={(event) => setTestRecipient(event.target.value)}
                      maxLength={320}
                      autoComplete="email"
                      placeholder="you@company.com"
                      required
                    />
                    <button
                      className="button shrink-0 gap-2"
                      type="submit"
                      disabled={
                        sendingTest || !settings.data.provider.apiKeyConfigured || templateDirty
                      }
                    >
                      {sendingTest ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <Send size={16} />
                      )}
                      Send test
                    </button>
                  </div>
                  {!settings.data.provider.apiKeyConfigured && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                      Save a Resend API key before sending a test.
                    </p>
                  )}
                  {templateDirty && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                      Save this template before testing it.
                    </p>
                  )}
                  <StatusMessage message={testMessage} compact />
                </form>
              </div>
            </aside>
          </section>

          <section className="mt-10" aria-labelledby="templates-title">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
                  Message studio
                </p>
                <h2 id="templates-title" className="mt-1 text-2xl font-semibold">
                  Transactional templates
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Edit the message and check the desktop preview before publishing.
                </p>
              </div>
              {templateDirty && <UnsavedIndicator />}
            </div>

            <div
              className="mt-5 grid gap-3 md:grid-cols-3"
              role="tablist"
              aria-label="Email templates"
            >
              {settings.data.templates.map((template) => (
                <button
                  key={template.type}
                  id={`tab-${template.type}`}
                  className={`card min-h-[132px] p-5 text-left transition hover:border-primary/50 ${
                    selectedType === template.type ? 'border-primary ring-2 ring-primary/15' : ''
                  }`}
                  type="button"
                  role="tab"
                  aria-selected={selectedType === template.type}
                  aria-controls="template-workspace"
                  disabled={savingTemplate || resettingTemplate}
                  onClick={() => chooseTemplate(template.type)}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{template.label}</span>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        template.customized
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-slate-500'
                      }`}
                    >
                      {template.customized ? 'Customized' : 'Default'}
                    </span>
                  </span>
                  <span className="mt-2 block text-sm leading-5 text-slate-500">
                    {template.description}
                  </span>
                </button>
              ))}
            </div>

            <div
              id="template-workspace"
              className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,.95fr)]"
              role="tabpanel"
              aria-labelledby={`tab-${selectedType}`}
            >
              <div className="card min-w-0 overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{selectedTemplate.label}</h3>
                      <p className="text-xs text-slate-500">
                        {selectedTemplate.customized
                          ? 'Organization customization'
                          : 'System default'}
                        {selectedTemplate.updatedAt
                          ? ` | Updated ${formatDate(selectedTemplate.updatedAt)}`
                          : ''}
                      </p>
                    </div>
                    <button
                      className="button-secondary !min-h-[36px] gap-2 !px-3"
                      type="button"
                      disabled={
                        savingTemplate ||
                        resettingTemplate ||
                        (!selectedTemplate.customized && !templateDirty)
                      }
                      onClick={() => void resetTemplate()}
                    >
                      {resettingTemplate ? (
                        <Loader2 className="animate-spin" size={15} />
                      ) : (
                        <RotateCcw size={15} />
                      )}
                      Restore default
                    </button>
                  </div>
                </div>

                <TemplateEditor
                  subject={subject}
                  html={html}
                  placeholders={selectedTemplate.placeholders}
                  revision={editorRevision}
                  disabled={savingTemplate || resettingTemplate}
                  onSubjectChange={setSubject}
                  onHtmlChange={setHtml}
                  onError={(text) => setTemplateMessage({ kind: 'error', text })}
                />

                <div className="border-t border-border bg-muted/20 p-5 sm:px-6">
                  <StatusMessage message={templateMessage} compact />
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      Saving publishes this template for future emails.
                    </p>
                    <button
                      className="button min-w-[145px] gap-2"
                      type="button"
                      disabled={savingTemplate || resettingTemplate || !templateDirty}
                      onClick={() => void saveTemplate()}
                    >
                      {savingTemplate && <Loader2 className="animate-spin" size={16} />}
                      {savingTemplate ? 'Saving...' : 'Save template'}
                    </button>
                  </div>
                </div>
              </div>

              <EmailPreview subject={subject} html={html} />
            </div>
          </section>
        </>
      ) : null}
    </Layout>
  );
}

function TemplateEditor({
  subject,
  html,
  placeholders,
  revision,
  disabled,
  onSubjectChange,
  onHtmlChange,
  onError,
}: {
  subject: string;
  html: string;
  placeholders: string[];
  revision: number;
  disabled: boolean;
  onSubjectChange: (value: string) => void;
  onHtmlChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const savedRange = useRef<Range | null>(null);
  const activeTarget = useRef<EditorTarget>('body');
  const [sourceMode, setSourceMode] = useState(false);

  useEffect(() => {
    if (sourceMode || !editorRef.current) return;
    if (editorRef.current.innerHTML !== html) editorRef.current.innerHTML = html;
  }, [html, revision, sourceMode]);

  function rememberSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange();
  }

  function restoreEditorSelection() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const range = savedRange.current;
    if (!range || !editor.contains(range.commonAncestorContainer)) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function syncHtml() {
    if (editorRef.current) onHtmlChange(editorRef.current.innerHTML);
    rememberSelection();
  }

  function runCommand(command: string, value?: string) {
    restoreEditorSelection();
    document.execCommand(command, false, value);
    syncHtml();
  }

  function insertLink() {
    restoreEditorSelection();
    const rawUrl = window.prompt('Enter an http, https, or mailto link:');
    if (!rawUrl) return;
    const url = normalizeLink(rawUrl);
    if (!url) {
      onError('Enter a valid http, https, or mailto link.');
      return;
    }
    const selection = window.getSelection();
    if (selection?.isCollapsed && savedRange.current) {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.textContent = url;
      savedRange.current.deleteContents();
      savedRange.current.insertNode(anchor);
      savedRange.current.setStartAfter(anchor);
      savedRange.current.collapse(true);
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
      syncHtml();
      return;
    }
    runCommand('createLink', url);
  }

  function insertPlaceholder(placeholder: string) {
    const token = `{{${placeholder}}}`;
    const urlPlaceholder = ['appUrl', 'signInUrl', 'resetUrl'].includes(placeholder);
    if (activeTarget.current === 'subject' && subjectRef.current) {
      if (urlPlaceholder) {
        onError('URL placeholders can only be inserted into email content.');
        return;
      }
      const input = subjectRef.current;
      const start = input.selectionStart ?? subject.length;
      const end = input.selectionEnd ?? start;
      const next = `${subject.slice(0, start)}${token}${subject.slice(end)}`;
      onSubjectChange(next);
      window.requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(start + token.length, start + token.length);
      });
      return;
    }
    if (activeTarget.current === 'source' && sourceRef.current) {
      const textarea = sourceRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const next = `${html.slice(0, start)}${token}${html.slice(end)}`;
      onHtmlChange(next);
      window.requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + token.length, start + token.length);
      });
      return;
    }
    restoreEditorSelection();
    if (urlPlaceholder && editorRef.current) {
      const editor = editorRef.current;
      const selection = window.getSelection();
      const range = savedRange.current ?? document.createRange();
      if (!savedRange.current) {
        range.selectNodeContents(editor);
        range.collapse(false);
      }
      const anchor = document.createElement('a');
      anchor.setAttribute('href', token);
      if (range.collapsed) anchor.textContent = 'Open link';
      else anchor.appendChild(range.extractContents());
      range.insertNode(anchor);
      range.setStartAfter(anchor);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      savedRange.current = range.cloneRange();
      syncHtml();
      return;
    }
    document.execCommand('insertText', false, token);
    syncHtml();
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Tab') {
      event.preventDefault();
      runCommand('insertText', '    ');
    }
  }

  const toolMouseDown = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault();

  return (
    <fieldset className="border-0 p-5 disabled:opacity-70 sm:p-6" disabled={disabled}>
      <label className="block text-sm font-medium" htmlFor="template-subject">
        Subject
      </label>
      <input
        ref={subjectRef}
        id="template-subject"
        className="input mt-2"
        value={subject}
        onChange={(event) => onSubjectChange(event.target.value)}
        onFocus={() => {
          activeTarget.current = 'subject';
        }}
        maxLength={200}
        required
      />

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-sm font-medium" id="template-content-label">
          Email content
        </span>
        <button
          className={`inline-flex min-h-[34px] items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition ${
            sourceMode
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card hover:bg-muted'
          }`}
          type="button"
          aria-pressed={sourceMode}
          onClick={() => {
            setSourceMode((current) => !current);
            activeTarget.current = sourceMode ? 'body' : 'source';
          }}
        >
          <Code2 size={14} aria-hidden="true" />
          {sourceMode ? 'Visual editor' : 'Source HTML'}
        </button>
      </div>

      {!sourceMode && (
        <div
          className="mt-2 flex flex-wrap gap-1 rounded-t-xl border border-b-0 border-border bg-muted/50 p-2"
          role="toolbar"
          aria-label="Email formatting"
        >
          <EditorTool label="Bold" onMouseDown={toolMouseDown} onClick={() => runCommand('bold')}>
            <Bold size={16} />
          </EditorTool>
          <EditorTool
            label="Italic"
            onMouseDown={toolMouseDown}
            onClick={() => runCommand('italic')}
          >
            <Italic size={16} />
          </EditorTool>
          <EditorTool
            label="Underline"
            onMouseDown={toolMouseDown}
            onClick={() => runCommand('underline')}
          >
            <Underline size={16} />
          </EditorTool>
          <ToolbarDivider />
          <EditorTool
            label="Heading 1"
            onMouseDown={toolMouseDown}
            onClick={() => runCommand('formatBlock', 'h1')}
          >
            <Heading1 size={16} />
          </EditorTool>
          <EditorTool
            label="Heading 2"
            onMouseDown={toolMouseDown}
            onClick={() => runCommand('formatBlock', 'h2')}
          >
            <Heading2 size={16} />
          </EditorTool>
          <EditorTool
            label="Paragraph"
            onMouseDown={toolMouseDown}
            onClick={() => runCommand('formatBlock', 'p')}
          >
            <Pilcrow size={16} />
          </EditorTool>
          <ToolbarDivider />
          <EditorTool
            label="Bulleted list"
            onMouseDown={toolMouseDown}
            onClick={() => runCommand('insertUnorderedList')}
          >
            <List size={16} />
          </EditorTool>
          <EditorTool
            label="Numbered list"
            onMouseDown={toolMouseDown}
            onClick={() => runCommand('insertOrderedList')}
          >
            <ListOrdered size={16} />
          </EditorTool>
          <ToolbarDivider />
          <EditorTool
            label="Align left"
            onMouseDown={toolMouseDown}
            onClick={() => runCommand('justifyLeft')}
          >
            <AlignLeft size={16} />
          </EditorTool>
          <EditorTool
            label="Align center"
            onMouseDown={toolMouseDown}
            onClick={() => runCommand('justifyCenter')}
          >
            <AlignCenter size={16} />
          </EditorTool>
          <EditorTool
            label="Align right"
            onMouseDown={toolMouseDown}
            onClick={() => runCommand('justifyRight')}
          >
            <AlignRight size={16} />
          </EditorTool>
          <EditorTool label="Insert link" onMouseDown={toolMouseDown} onClick={insertLink}>
            <Link2 size={16} />
          </EditorTool>
          <ToolbarDivider />
          <EditorTool label="Undo" onMouseDown={toolMouseDown} onClick={() => runCommand('undo')}>
            <Undo2 size={16} />
          </EditorTool>
          <EditorTool label="Redo" onMouseDown={toolMouseDown} onClick={() => runCommand('redo')}>
            <Redo2 size={16} />
          </EditorTool>
        </div>
      )}

      {sourceMode ? (
        <textarea
          ref={sourceRef}
          className="mt-2 min-h-[360px] w-full resize-y rounded-xl border border-border bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100"
          value={html}
          onChange={(event) => onHtmlChange(event.target.value)}
          onFocus={() => {
            activeTarget.current = 'source';
          }}
          aria-labelledby="template-content-label"
          spellCheck={false}
        />
      ) : (
        <div
          ref={editorRef}
          className="min-h-[360px] overflow-auto rounded-b-xl border border-border bg-background p-5 text-sm leading-6 [&_a]:text-primary [&_a]:underline [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6"
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-labelledby="template-content-label"
          tabIndex={0}
          spellCheck
          onFocus={() => {
            activeTarget.current = 'body';
            rememberSelection();
          }}
          onInput={syncHtml}
          onKeyDown={handleEditorKeyDown}
          onKeyUp={rememberSelection}
          onMouseUp={rememberSelection}
          onBlur={syncHtml}
        />
      )}

      <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-500">
          Available placeholders
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Place the cursor in the subject or content, then insert a sample-backed token. URL tokens
          become links in the visual editor and must be a link&apos;s complete href in source mode.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {placeholders.map((placeholder) => (
            <button
              key={placeholder}
              className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 font-mono text-xs font-medium text-primary transition hover:bg-primary/10"
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertPlaceholder(placeholder)}
              title={`Insert {{${placeholder}}}`}
            >
              {`{{${placeholder}}}`}
            </button>
          ))}
        </div>
      </div>
    </fieldset>
  );
}

function EmailPreview({ subject, html }: { subject: string; html: string }) {
  const renderedSubject = substituteSamples(subject, false);
  const renderedHtml = substituteSamples(html, true);
  const previewDocument = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src data:">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px 20px; background: #f3f4f6; color: #172033; font-family: Arial, sans-serif; }
    .email { max-width: 680px; min-height: 420px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; box-shadow: 0 8px 30px rgba(15, 23, 42, .08); }
    a { color: #6d5ce7; }
    img { max-width: 100%; }
    @media (max-width: 540px) { body { padding: 12px; } .email { padding: 20px; } }
  </style>
</head>
<body><main class="email">${renderedHtml}</main></body>
</html>`;

  return (
    <aside className="card min-w-0 overflow-hidden xl:sticky xl:top-20 xl:self-start">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">
            Live preview
          </p>
          <h3 className="mt-0.5 font-semibold">Desktop email</h3>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
        </span>
      </div>
      <div className="border-b border-border bg-card px-5 py-3">
        <p className="truncate text-xs text-slate-500">Subject</p>
        <p className="mt-0.5 truncate text-sm font-medium" title={renderedSubject}>
          {renderedSubject || 'Your email subject'}
        </p>
      </div>
      <iframe
        className="h-[560px] w-full bg-slate-100"
        title="Email template preview"
        sandbox=""
        srcDoc={previewDocument}
      />
      <div className="border-t border-border bg-muted/30 px-5 py-3 text-xs text-slate-500">
        Preview values are examples. Actual recipient data is substituted when email is sent.
      </div>
    </aside>
  );
}

function EditorTool({
  label,
  children,
  onClick,
  onMouseDown,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  onMouseDown: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className="grid h-8 w-8 place-items-center rounded-md text-slate-600 transition hover:bg-card hover:text-foreground dark:text-slate-300"
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseDown={onMouseDown}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-8 w-px bg-border" aria-hidden="true" />;
}

function SetupStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {number}
      </span>
      <span>
        <strong className="block text-foreground">{title}</strong>
        <span className="mt-1 block leading-5 text-slate-500">{children}</span>
      </span>
    </li>
  );
}

function ExternalAnchor({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {children} <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

function StatusMessage({ message, compact = false }: { message: Message; compact?: boolean }) {
  if (!message) return null;
  return (
    <div
      className={`${compact ? 'mb-3 mt-3' : 'mt-6'} flex items-start gap-2 rounded-lg p-3 text-sm ${
        message.kind === 'error'
          ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
      }`}
      role={message.kind === 'error' ? 'alert' : 'status'}
    >
      {message.kind === 'success' && <CheckCircle2 className="mt-0.5 shrink-0" size={16} />}
      {message.text}
    </div>
  );
}

function UnsavedIndicator() {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
      <span className="h-2 w-2 rounded-full bg-amber-500" /> Unsaved changes
    </span>
  );
}

function LoadingState() {
  return (
    <div
      className="mt-8 grid animate-pulse gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"
      aria-label="Loading email settings"
    >
      <div className="card p-7">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="mt-7 h-11 rounded bg-muted" />
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="h-11 rounded bg-muted" />
          <div className="h-11 rounded bg-muted" />
        </div>
        <div className="mt-5 h-11 rounded bg-muted" />
      </div>
      <div className="card h-80 bg-muted/60" />
    </div>
  );
}

function emptyProvider(): ProviderDraft {
  return { resendApiKey: '', fromName: '', fromEmail: '', replyTo: '', enabled: false };
}

function providerFromSettings(provider: EmailProvider): ProviderDraft {
  return {
    resendApiKey: '',
    fromName: provider.fromName,
    fromEmail: provider.fromEmail,
    replyTo: provider.replyTo ?? '',
    enabled: provider.enabled,
  };
}

async function readResponse<T>(response: Response): Promise<{
  data?: T;
  error?: { message?: string };
}> {
  try {
    return (await response.json()) as { data?: T; error?: { message?: string } };
  } catch {
    return {};
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function normalizeLink(value: string): string | null {
  const trimmed = value.trim();
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function substituteSamples(value: string, escapeValues: boolean): string {
  return value.replace(/{{\s*([A-Za-z][A-Za-z0-9]*)\s*}}/g, (token, key: string) => {
    const replacement = sampleValues[key];
    if (replacement === undefined) return token;
    return escapeValues ? escapeHtml(replacement) : replacement;
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'recently'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}
