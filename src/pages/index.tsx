import { AppCard, type AppView } from '@/components/app-card';
import { Layout } from '@/components/layout';
import { useApi } from '@/hooks/use-api';

export default function Dashboard() {
  const apps = useApi<AppView[]>('/api/v1/applications');
  const me = useApi<{ name: string; organizationRole: string }>('/api/v1/me');
  return (
    <Layout admin={['OWNER', 'ADMIN'].includes(me.data?.organizationRole ?? '')}>
      <header>
        <p className="text-sm font-medium text-primary">WORKSPACE</p>
        <h1 className="mt-2 text-3xl font-semibold">
          Good to see you, {me.data?.name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="mt-2 text-slate-500">Your assigned applications, ready when you are.</p>
      </header>
      {apps.loading ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-56 animate-pulse bg-muted" />
          ))}
        </div>
      ) : apps.error ? (
        <p role="alert" className="mt-10 text-red-600">
          {apps.error}
        </p>
      ) : apps.data?.length ? (
        <section className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {apps.data.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </section>
      ) : (
        <div className="card mt-10 p-12 text-center">
          <h2 className="font-semibold">No assigned applications</h2>
          <p className="mt-2 text-sm text-slate-500">
            Explore the marketplace or ask an administrator for access.
          </p>
        </div>
      )}
    </Layout>
  );
}
