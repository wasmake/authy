import { Grid3X3, LogOut, Moon, Search, ShieldCheck, Sun, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTheme } from 'next-themes';
import type { ReactNode } from 'react';

import { authClient } from '@/modules/auth/client';

export function Layout({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-border bg-card p-5 md:min-h-screen md:border-b-0 md:border-r">
        <Link href="/" passHref>
          {/* Next.js injects href through passHref. */}
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <a className="mb-8 flex items-center gap-3 text-xl font-bold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white">
              <ShieldCheck size={20} />
            </span>
            Authy
          </a>
        </Link>
        <nav aria-label="Primary" className="mt-6 flex gap-2 md:flex-col">
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
          {admin && (
            <Nav href="/admin" icon={<Users size={17} />} active={router.pathname === '/admin'}>
              Admin
            </Nav>
          )}
        </nav>
        <div className="mt-6 flex gap-2 md:absolute md:bottom-5">
          <button
            className="button-secondary !px-3"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            className="button-secondary gap-2"
            onClick={async () => {
              await authClient.signOut();
              await router.push('/sign-in');
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <main className="p-5 md:p-10">{children}</main>
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
        {children}
      </a>
    </Link>
  );
}
