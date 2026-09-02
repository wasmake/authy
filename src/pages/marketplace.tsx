import { useState } from 'react';

import { AppCard, type AppView } from '@/components/app-card';
import { Layout } from '@/components/layout';
import { useApi } from '@/hooks/use-api';

export default function Marketplace() {
  const { data = [], loading } = useApi<AppView[]>('/api/v1/applications?marketplace=true');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const visible = data.filter((app) =>
    `${app.name} ${app.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  async function requestAccess(applicationId: string) {
    const reason = prompt('Why do you need access?');
    if (!reason) return;
    const response = await fetch('/api/v1/access-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ applicationId, reason }),
    });
    setMessage(response.ok ? 'Request sent for approval.' : 'Unable to submit request.');
  }
  return (
    <Layout>
      <header>
        <p className="text-sm font-medium text-primary">APP CATALOG</p>
        <h1 className="mt-2 text-3xl font-semibold">Discover your toolkit</h1>
        <div className="mt-6 max-w-xl">
          <label htmlFor="search" className="sr-only">
            Search applications
          </label>
          <input
            id="search"
            className="input"
            placeholder="Search applications…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {message && (
          <p role="status" className="mt-4 text-sm text-accent">
            {message}
          </p>
        )}
      </header>
      {loading ? (
        <p className="mt-10">Loading catalog…</p>
      ) : (
        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((app) => (
            <AppCard key={app.id} app={app} requestAccess={requestAccess} />
          ))}
        </section>
      )}
    </Layout>
  );
}
