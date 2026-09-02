import { Layout } from '@/components/layout';
import { useApi } from '@/hooks/use-api';

type Metrics = {
  users: number;
  applications: number;
  pendingRequests: number;
  signIns: number;
  securityEvents: number;
};
type Request = {
  id: string;
  status: string;
  reason: string;
  application: { name: string };
  requester: { name: string; email: string };
};
export default function Admin() {
  const metrics = useApi<Metrics>('/api/v1/admin/metrics');
  const requests = useApi<Request[]>('/api/v1/access-requests');
  async function decide(id: string, status: 'APPROVED' | 'DENIED') {
    await fetch(`/api/v1/access-requests/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    requests.setData(requests.data?.map((r) => (r.id === id ? { ...r, status } : r)));
  }
  return (
    <Layout admin>
      <header>
        <p className="text-sm font-medium text-primary">ADMIN CONTROL PLANE</p>
        <h1 className="mt-2 text-3xl font-semibold">Workspace overview</h1>
        <p className="mt-2 text-slate-500">Identity posture and access operations at a glance.</p>
      </header>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Object.entries(metrics.data ?? {}).map(([key, value]) => (
          <div className="card p-5" key={key}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {key.replace(/([A-Z])/g, ' $1')}
            </p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </section>
      <section className="card mt-8 overflow-hidden">
        <div className="border-b border-border p-5">
          <h2 className="font-semibold">Access requests</h2>
        </div>
        <div className="divide-y divide-border">
          {requests.data?.map((request) => (
            <div
              className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
              key={request.id}
            >
              <div>
                <p className="font-medium">
                  {request.requester.name} <span className="text-slate-400">→</span>{' '}
                  {request.application.name}
                </p>
                <p className="mt-1 text-sm text-slate-500">{request.reason}</p>
              </div>
              {request.status === 'PENDING' ? (
                <div className="flex gap-2">
                  <button className="button-secondary" onClick={() => decide(request.id, 'DENIED')}>
                    Deny
                  </button>
                  <button className="button" onClick={() => decide(request.id, 'APPROVED')}>
                    Approve
                  </button>
                </div>
              ) : (
                <span className="text-sm font-semibold">{request.status}</span>
              )}
            </div>
          ))}
          {!requests.data?.length && (
            <p className="p-8 text-center text-sm text-slate-500">No requests need attention.</p>
          )}
        </div>
      </section>
    </Layout>
  );
}
