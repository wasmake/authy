import {
  Grid3X3,
  KeyRound,
  LayoutDashboard,
  Moon,
  Palette,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
  UsersRound,
  Vault,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { ProductTour } from '@/components/product-tour';
import { Spotlight } from '@/components/spotlight';
import { useApi } from '@/hooks/use-api';

type Me = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  mustChangePassword: boolean;
  onboardingCompletedAt: string | null;
  organizationRole: string;
  organization: { name: string; logo?: string | null; primaryColor: string };
};

export function Layout({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const me = useApi<Me>('/api/v1/me');
  const canAdmin = admin || ['OWNER', 'ADMIN'].includes(me.data?.organizationRole ?? '');
  const tourActive = router.query.tour === '1' && !me.data?.onboardingCompletedAt;
  const style = me.data?.organization.primaryColor
    ? ({ '--brand-color': me.data.organization.primaryColor } as CSSProperties)
    : undefined;

  useEffect(() => {
    if (me.data?.mustChangePassword && router.pathname !== '/change-password') {
      void router.replace('/change-password');
    }
  }, [me.data?.mustChangePassword, router]);

  if (me.data?.mustChangePassword) return null;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_minmax(0,1fr)]" style={style}>
      <aside className="flex border-b border-border bg-card p-4 md:sticky md:top-0 md:h-screen md:flex-col md:border-b-0 md:border-r">
        <Link href="/" passHref>
          {/* Next.js injects href through passHref. */}
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <a
            className="flex items-center gap-3 px-2 py-1 text-xl font-bold"
            aria-label="Authy home"
          >
            <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-primary text-white">
              {me.data?.organization.logo ? (
                // Organization-controlled URL is validated server-side.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="h-full w-full object-contain"
                  src={me.data.organization.logo}
                  alt=""
                />
              ) : (
                <ShieldCheck size={20} />
              )}
            </span>
            <span>{me.data?.organization.name ?? 'Authy'}</span>
          </a>
        </Link>
        <nav
          aria-label="Primary"
          className="ml-5 flex min-w-0 flex-1 gap-1 overflow-x-auto whitespace-nowrap md:ml-0 md:mt-7 md:flex-none md:flex-col md:overflow-visible"
        >
          <Nav href="/" icon={<Grid3X3 size={17} />} active={router.pathname === '/'}>
            My apps
          </Nav>
          <Nav
            href="/marketplace"
            icon={<Search size={17} />}
            active={router.pathname === '/marketplace'}
          >
            Marketplace
          </Nav>
          <Nav href="/vault" icon={<Vault size={17} />} active={router.pathname === '/vault'}>
            Vault
          </Nav>
          {canAdmin && (
            <>
              <p className="mb-1 mt-6 hidden px-3 text-[11px] font-bold uppercase tracking-[.15em] text-slate-400 md:block">
                Admin
              </p>
              <Nav
                href="/admin"
                icon={<LayoutDashboard size={17} />}
                active={router.pathname === '/admin'}
              >
                Overview
              </Nav>
              <Nav
                href="/admin-applications"
                icon={<Workflow size={17} />}
                active={router.pathname === '/admin-applications'}
              >
                Applications
              </Nav>
              <Nav
                href="/admin-users"
                icon={<UserRound size={17} />}
                active={router.pathname === '/admin-users'}
              >
                People
              </Nav>
              <Nav
                href="/admin-groups"
                icon={<UsersRound size={17} />}
                active={router.pathname === '/admin-groups'}
              >
                Groups & RBAC
              </Nav>
              <Nav
                href="/admin-authentication"
                icon={<KeyRound size={17} />}
                active={router.pathname === '/admin-authentication'}
              >
                Authentication
              </Nav>
              <Nav
                href="/admin-settings"
                icon={<Palette size={17} />}
                active={router.pathname === '/admin-settings'}
              >
                Brand settings
              </Nav>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0 md:mt-auto md:block">
          <Link href="/profile" passHref>
            {/* Next.js injects href through passHref. */}
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a
              aria-label={`Profile settings for ${me.data?.name ?? 'current user'}`}
              className="flex items-center gap-3 rounded-xl border border-border p-3 transition hover:bg-muted"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                {me.data?.name?.charAt(0) ?? <UserRound size={17} />}
              </span>
              <span className="hidden min-w-0 flex-1 md:block">
                <span className="block truncate text-sm font-semibold">
                  {me.data?.name ?? 'Account'}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {me.data?.email ?? 'Loading...'}
                </span>
              </span>
              <Settings className="hidden text-slate-400 md:block" size={16} />
            </a>
          </Link>
          <button
            className="mt-2 hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-muted md:flex"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            type="button"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}{' '}
            {theme === 'dark' ? 'Light appearance' : 'Dark appearance'}
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="sticky top-0 z-30 border-b border-border bg-background/85 px-5 py-3 backdrop-blur-xl md:px-10">
          <Spotlight admin={canAdmin} />
        </div>
        <main className="p-5 md:p-8 xl:p-10">{children}</main>
      </div>
      <ProductTour active={tourActive} admin={canAdmin} />
    </div>
  );
}

function Nav({
  href,
  icon,
  active,
  children,
}: {
  href: string;
  icon: ReactNode;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href} passHref>
      {/* Next.js injects href through passHref. */}
      {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
      <a
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active ? 'bg-primary text-white' : 'text-slate-500 hover:bg-muted hover:text-foreground'}`}
      >
        {icon}
        <span>{children}</span>
      </a>
    </Link>
  );
}
