import { Building2, CheckCircle2, Image as ImageIcon, Palette } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { Layout } from '@/components/layout';
import { useApi } from '@/hooks/use-api';

type Settings = {
  name: string;
  greeting: string;
  logo: string | null;
  primaryColor: string;
};

export default function AdminSettings() {
  const settings = useApi<Settings>('/api/v1/admin/settings');
  const [name, setName] = useState('');
  const [greeting, setGreeting] = useState('');
  const [logo, setLogo] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6D5CE7');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!settings.data) return;
    setName(settings.data.name);
    setGreeting(settings.data.greeting);
    setLogo(settings.data.logo ?? '');
    setPrimaryColor(settings.data.primaryColor);
  }, [settings.data]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setSaveError('');
    try {
      const response = await fetch('/api/v1/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          greeting,
          logo: logo.trim() || null,
          primaryColor: primaryColor.toUpperCase(),
        }),
      });
      const body = (await response.json()) as {
        data?: Settings;
        error?: { message?: string };
      };
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message ?? 'Unable to save organization settings');
      }
      settings.setData(body.data);
      setMessage('Organization branding saved.');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save organization settings');
    } finally {
      setSaving(false);
    }
  }

  const previewColor = /^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : '#6D5CE7';
  const previewTextColor = contrastingText(previewColor);

  return (
    <Layout admin>
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-primary">ORGANIZATION SETTINGS</p>
        <h1 className="mt-2 text-3xl font-semibold">Make the workspace yours</h1>
        <p className="mt-2 text-slate-500">
          Set the identity your team sees across their organization workspace.
        </p>
      </header>

      {settings.loading ? (
        <div className="card mt-8 max-w-3xl animate-pulse p-8" aria-label="Loading settings">
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="mt-7 h-11 rounded bg-muted" />
          <div className="mt-5 h-11 rounded bg-muted" />
          <div className="mt-5 h-11 rounded bg-muted" />
        </div>
      ) : settings.error ? (
        <div
          role="alert"
          className="mt-8 max-w-3xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950"
        >
          {settings.error}
        </div>
      ) : (
        <form
          className="mt-8 grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"
          onSubmit={submit}
        >
          <section className="card p-6 sm:p-8">
            <div className="flex items-center gap-3 border-b border-border pb-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-primary">
                <Building2 size={19} />
              </span>
              <div>
                <h2 className="font-semibold">Brand details</h2>
                <p className="text-sm text-slate-500">
                  The essentials people use to recognize you.
                </p>
              </div>
            </div>

            <label className="mt-6 block text-sm font-medium" htmlFor="organization-name">
              Organization name
            </label>
            <input
              id="organization-name"
              className="input mt-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={100}
              required
            />

            <label className="mt-5 block text-sm font-medium" htmlFor="greeting">
              Greeting
            </label>
            <input
              id="greeting"
              className="input mt-2"
              value={greeting}
              onChange={(event) => setGreeting(event.target.value)}
              minLength={2}
              maxLength={160}
              required
            />
            <p className="mt-2 text-xs text-slate-500">
              A short welcome shown at the top of the workspace.
            </p>

            <label className="mt-5 block text-sm font-medium" htmlFor="logo">
              Logo URL <span className="font-normal text-slate-400">Optional</span>
            </label>
            <div className="relative mt-2">
              <ImageIcon className="absolute left-3 top-3.5 text-slate-400" size={16} />
              <input
                id="logo"
                className="input pl-10"
                type="url"
                value={logo}
                onChange={(event) => setLogo(event.target.value)}
                maxLength={2048}
                placeholder="https://example.com/logo.svg"
              />
            </div>

            <div className="mt-8 flex items-center gap-3 border-b border-border pb-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-primary">
                <Palette size={19} />
              </span>
              <div>
                <h2 className="font-semibold">Primary color</h2>
                <p className="text-sm text-slate-500">Used for key actions and brand accents.</p>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <input
                aria-label="Choose primary color"
                className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-background p-1"
                type="color"
                value={previewColor}
                onChange={(event) => setPrimaryColor(event.target.value.toUpperCase())}
              />
              <div className="flex-1">
                <label className="sr-only" htmlFor="primary-color">
                  Primary color hex value
                </label>
                <input
                  id="primary-color"
                  className="input font-mono uppercase tracking-wider"
                  value={primaryColor}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                  pattern="#[0-9a-fA-F]{6}"
                  maxLength={7}
                  placeholder="#6D5CE7"
                  required
                />
              </div>
            </div>

            {(message || saveError) && (
              <div
                role={saveError ? 'alert' : 'status'}
                className={`mt-6 flex items-center gap-2 rounded-lg p-3 text-sm ${
                  saveError
                    ? 'bg-red-50 text-red-700 dark:bg-red-950'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                }`}
              >
                {!saveError && <CheckCircle2 size={17} />}
                {saveError || message}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button className="button min-w-[140px]" disabled={saving} type="submit">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </section>

          <aside className="xl:sticky xl:top-8 xl:self-start">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-slate-500">
              Live preview
            </p>
            <div className="card overflow-hidden">
              <div className="h-2" style={{ backgroundColor: previewColor }} />
              <div className="p-7">
                <div
                  className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl text-xl font-semibold shadow-sm"
                  style={{ backgroundColor: previewColor, color: previewTextColor }}
                >
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="h-full w-full object-contain"
                      src={logo}
                      alt="Organization logo preview"
                    />
                  ) : (
                    (name.trim().charAt(0) || 'O').toUpperCase()
                  )}
                </div>
                <p className="mt-7 text-sm text-slate-500">
                  {greeting || 'Welcome to your workspace'}
                </p>
                <h2 className="mt-1 text-2xl font-semibold">{name || 'Your organization'}</h2>
                <div className="mt-7 rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-medium">Your applications</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Everything you need, in one secure place.
                  </p>
                  <button
                    className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold"
                    style={{ backgroundColor: previewColor, color: previewTextColor }}
                    type="button"
                  >
                    Open workspace
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </form>
      )}
    </Layout>
  );
}

function contrastingText(hex: string): string {
  const [red, green, blue] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? '#111827' : '#FFFFFF';
}
