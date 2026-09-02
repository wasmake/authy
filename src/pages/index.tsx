import { Clock3 } from 'lucide-react';

import { AppCard, type AppView } from '@/components/app-card';
import { AppIcon } from '@/components/app-icon';
import { Layout } from '@/components/layout';
import { useApi } from '@/hooks/use-api';

type Me = { name: string; organizationRole: string; organization: { greeting: string } };

export default function Dashboard() {
  const apps = useApi<AppView[]>('/api/v1/applications');
  const me = useApi<Me>('/api/v1/me');
  const recent = (apps.data ?? [])
    .filter((app) => app.usage?.length)
    .sort(
      (left, right) =>
        new Date(right.usage?.[0].usedAt ?? 0).getTime() -
        new Date(left.usage?.[0].usedAt ?? 0).getTime(),
    )
    .slice(0, 5);
  return (
    <Layout admin={['OWNER', 'ADMIN'].includes(me.data?.organizationRole ?? '')}>
      <header>
        <p className="text-sm font-medium text-primary">WORKSPACE</p>
        <h1 className="mt-2 text-3xl font-semibold">
          {me.data?.organization.greeting ?? 'Good to see you'},{' '}
          {me.data?.name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="mt-2 text-slate-500">Everything you need, one secure click away.</p>
      </header>
      {recent.length > 0 && (
        <section className="mt-9" aria-labelledby="recent-heading">
          <div className="mb-4 flex items-center gap-2">
            <Clock3 className="text-primary" size={18} />
            <h2 id="recent-heading" className="font-semibold">
              Recent apps
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {recent.map((app) => (
              <a
                href={`/api/v1/applications/${app.id}/launch`}
                key={app.id}
                className="card flex items-center gap-3 p-3 transition hover:border-primary/30 hover:shadow-md"
              >
                <AppIcon name={app.name} compact />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{app.name}</span>
                  <span className="text-xs text-slate-400">
                    Used {new Date(app.usage?.[0].usedAt ?? '').toLocaleDateString()}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}
      <section className="mt-9" aria-labelledby="all-apps-heading">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 id="all-apps-heading" className="text-lg font-semibold">
              All applications
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {apps.data?.length ?? 0} applications assigned to you
            </p>
          </div>
        </div>
        {apps.loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card h-44 animate-pulse bg-muted" />
            ))}
          </div>
        ) : apps.error ? (
          <p role="alert" className="text-red-600">
            {apps.error}
          </p>
        ) : apps.data?.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {apps.data.map((app) => (
              <AppCard key={app.id} app={app} compact />
            ))}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <h2 className="font-semibold">No assigned applications</h2>
            <p className="mt-2 text-sm text-slate-500">
              Explore the marketplace or ask an administrator for access.
            </p>
          </div>
        )}
      </section>
    </Layout>
  );
}
