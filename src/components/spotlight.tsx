import { ArrowRight, Command, Search, X } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

import { AppIcon } from '@/components/app-icon';
import { useApi } from '@/hooks/use-api';
import { openApplicationInFocusedTab } from '@/modules/applications/launch';

type SearchApp = { id: string; name: string; description?: string | null; type: string };
type Destination = { label: string; detail: string; href: string; admin?: boolean };

const destinations: Destination[] = [
  { label: 'My applications', detail: 'Assigned applications', href: '/' },
  { label: 'Application marketplace', detail: 'Discover and request access', href: '/marketplace' },
  { label: 'Admin overview', detail: 'Metrics and approvals', href: '/admin', admin: true },
  {
    label: 'Application integrations',
    detail: 'Connect a new platform',
    href: '/admin-applications',
    admin: true,
  },
  {
    label: 'People and access',
    detail: 'Users, roles, groups, and apps',
    href: '/admin-users',
    admin: true,
  },
  {
    label: 'Groups and RBAC',
    detail: 'Manage inherited access',
    href: '/admin-groups',
    admin: true,
  },
  {
    label: 'Organization settings',
    detail: 'Brand, greeting, logo, and color',
    href: '/admin-settings',
    admin: true,
  },
  {
    label: 'Email delivery',
    detail: 'Resend connection and transactional templates',
    href: '/admin-email',
    admin: true,
  },
  { label: 'Profile and security', detail: 'Account and active sessions', href: '/profile' },
];

export function Spotlight({ admin }: { admin: boolean }) {
  const router = useRouter();
  const apps = useApi<SearchApp[]>('/api/v1/applications');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const normalized = query.trim().toLowerCase();
  const pages = destinations.filter(
    (item) =>
      (!item.admin || admin) && `${item.label} ${item.detail}`.toLowerCase().includes(normalized),
  );
  const foundApps = (apps.data ?? []).filter((app) =>
    `${app.name} ${app.description ?? ''} ${app.type}`.toLowerCase().includes(normalized),
  );

  function navigate(href: string) {
    setOpen(false);
    setQuery('');
    void router.push(href);
  }

  function launchApplication(applicationId: string) {
    setOpen(false);
    setQuery('');
    openApplicationInFocusedTab(applicationId);
  }

  return (
    <>
      <button
        className="mx-auto flex h-11 w-full max-w-xl items-center gap-3 rounded-xl border border-border bg-card px-4 text-left text-sm text-slate-400 shadow-sm transition hover:border-primary/40 hover:shadow-md"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Search size={17} />
        <span className="flex-1">Search apps and settings</span>
        <span className="flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs">
          <Command size={12} /> K
        </span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/45 px-4 pt-[12vh] backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <section
            aria-label="Search Authy"
            aria-modal="true"
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            role="dialog"
          >
            <label className="flex items-center gap-3 border-b border-border px-5">
              <Search className="text-primary" size={21} />
              <span className="sr-only">Search applications and navigation</span>
              <input
                ref={inputRef}
                className="h-16 flex-1 bg-transparent text-lg outline-none placeholder:text-slate-400"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Authy..."
                value={query}
              />
              <button
                aria-label="Close search"
                className="rounded-lg p-2 text-slate-400 hover:bg-muted"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </label>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {foundApps.length > 0 && (
                <ResultGroup title="Applications">
                  {foundApps.map((app) => (
                    <Result
                      key={app.id}
                      label={app.name}
                      detail={`Launch ${app.type.toLowerCase()} application`}
                      icon={<AppIcon name={app.name} compact />}
                      onClick={() => launchApplication(app.id)}
                    />
                  ))}
                </ResultGroup>
              )}
              {pages.length > 0 && (
                <ResultGroup title="Pages and settings">
                  {pages.map((item) => (
                    <Result
                      key={item.href}
                      label={item.label}
                      detail={item.detail}
                      icon={<Search size={17} />}
                      onClick={() => navigate(item.href)}
                    />
                  ))}
                </ResultGroup>
              )}
              {!foundApps.length && !pages.length && (
                <div className="px-5 py-12 text-center">
                  <p className="font-medium">No results for “{query}”</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Try an app, person, or settings page.
                  </p>
                </div>
              )}
            </div>
            <footer className="flex items-center gap-4 border-t border-border bg-muted/40 px-5 py-3 text-xs text-slate-400">
              <span>Type to filter</span>
              <span>↵ open</span>
              <span>esc close</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </p>
      {children}
    </div>
  );
}

function Result({
  label,
  detail,
  icon,
  onClick,
}: {
  label: string;
  detail: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-muted"
      onClick={onClick}
      type="button"
    >
      <span className="grid h-9 w-9 place-items-center text-primary">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-slate-500">{detail}</span>
      </span>
      <ArrowRight className="text-slate-300 group-hover:text-primary" size={16} />
    </button>
  );
}
