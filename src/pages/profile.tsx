import { KeyRound, LogOut, Monitor, ShieldCheck, UserRound } from 'lucide-react';
import { useRouter } from 'next/router';

import { Layout } from '@/components/layout';
import { useApi } from '@/hooks/use-api';
import { authClient } from '@/modules/auth/client';

type Me = { name: string; email: string; organizationRole: string; organization: { name: string } };
export default function Profile() {
  const me = useApi<Me>('/api/v1/me');
  const router = useRouter();
  return (
    <Layout>
      <header>
        <p className="text-sm font-medium text-primary">ACCOUNT</p>
        <h1 className="mt-2 text-3xl font-semibold">Profile and security</h1>
        <p className="mt-2 text-slate-500">Review your identity and protect your active session.</p>
      </header>
      <div className="mt-8 grid max-w-5xl gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-xl font-bold text-primary">
              {me.data?.name.charAt(0) ?? <UserRound />}
            </span>
            <div>
              <h2 className="font-semibold">{me.data?.name ?? 'Loading...'}</h2>
              <p className="text-sm text-slate-500">{me.data?.email}</p>
            </div>
          </div>
          <dl className="mt-6 divide-y divide-border border-y border-border text-sm">
            <div className="flex justify-between py-4">
              <dt className="text-slate-500">Organization</dt>
              <dd className="font-medium">{me.data?.organization.name}</dd>
            </div>
            <div className="flex justify-between py-4">
              <dt className="text-slate-500">Workspace role</dt>
              <dd className="font-medium">{me.data?.organizationRole}</dd>
            </div>
          </dl>
        </section>
        <section className="card p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-primary" />
            <div>
              <h2 className="font-semibold">Security</h2>
              <p className="text-sm text-slate-500">Your current browser session</p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-background p-4">
            <Monitor className="text-slate-400" />
            <div className="flex-1">
              <p className="text-sm font-medium">Current device</p>
              <p className="text-xs text-emerald-600">Active now</p>
            </div>
            <KeyRound className="text-slate-300" size={17} />
          </div>
          <button
            className="button-secondary mt-6 w-full gap-2"
            onClick={async () => {
              await authClient.signOut();
              await router.push('/sign-in');
            }}
          >
            <LogOut size={16} />
            Sign out this session
          </button>
        </section>
      </div>
    </Layout>
  );
}
