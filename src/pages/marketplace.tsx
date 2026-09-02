import { CheckCircle2, Search, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { AppCard, type AppView } from '@/components/app-card';
import { AppIcon } from '@/components/app-icon';
import { Layout } from '@/components/layout';
import { useApi } from '@/hooks/use-api';

export default function Marketplace() {
  const { data = [], loading } = useApi<AppView[]>('/api/v1/applications?marketplace=true');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AppView>();
  const [reason, setReason] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'sent'>('idle');
  const [error, setError] = useState('');
  const visible = data.filter((app) =>
    `${app.name} ${app.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setState('saving');
    setError('');
    const response = await fetch('/api/v1/access-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ applicationId: selected.id, reason }),
    });
    const body = (await response.json()) as { error?: { message?: string } };
    if (response.ok) setState('sent');
    else {
      setError(body.error?.message ?? 'Unable to submit request');
      setState('idle');
    }
  }
  function close() {
    setSelected(undefined);
    setReason('');
    setError('');
    setState('idle');
  }
  return (
    <Layout>
      <header>
        <p className="text-sm font-medium text-primary">APP CATALOG</p>
        <h1 className="mt-2 text-3xl font-semibold">Discover your toolkit</h1>
        <p className="mt-2 text-slate-500">
          Browse approved integrations and request the access you need.
        </p>
        <label className="relative mt-6 block max-w-xl">
          <span className="sr-only">Search applications</span>
          <Search className="absolute left-4 top-3.5 text-slate-400" size={17} />
          <input
            className="input pl-11"
            placeholder="Search applications..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </header>
      {loading ? (
        <p className="mt-10">Loading catalog...</p>
      ) : (
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {visible.map((app) => (
            <AppCard key={app.id} app={app} requestAccess={() => setSelected(app)} />
          ))}
        </section>
      )}
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <section
            className="card w-full max-w-lg p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-title"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <AppIcon name={selected.name} />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Access request
                  </p>
                  <h2 id="request-title" className="text-xl font-semibold">
                    Request {selected.name}
                  </h2>
                </div>
              </div>
              <button
                className="rounded-lg p-2 hover:bg-muted"
                onClick={close}
                aria-label="Close request"
              >
                <X size={18} />
              </button>
            </div>
            {state === 'sent' ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="mx-auto text-emerald-500" size={42} />
                <h3 className="mt-4 text-lg font-semibold">Request sent</h3>
                <p className="mt-2 text-sm text-slate-500">
                  An administrator will review your request.
                </p>
                <button className="button mt-6" onClick={close}>
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <p className="mt-6 text-sm text-slate-500">
                  Tell your administrator why this application is needed. This context will appear
                  in the approval queue.
                </p>
                <label className="mt-5 block text-sm font-medium" htmlFor="reason">
                  Business reason
                </label>
                <textarea
                  id="reason"
                  className="mt-2 min-h-[120px] w-full rounded-lg border border-border bg-background p-3 text-sm"
                  minLength={5}
                  maxLength={500}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="I need access to..."
                />
                {error && (
                  <p role="alert" className="mt-3 text-sm text-red-600">
                    {error}
                  </p>
                )}
                <div className="mt-6 flex justify-end gap-2">
                  <button type="button" className="button-secondary" onClick={close}>
                    Cancel
                  </button>
                  <button className="button" disabled={state === 'saving'}>
                    {state === 'saving' ? 'Sending...' : 'Send request'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </Layout>
  );
}
