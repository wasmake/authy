import { useRouter } from 'next/router';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  mustChangePassword: boolean;
  onboardingCompletedAt: string | null;
  organizationRole: string;
  organization: {
    name: string;
    logo?: string | null;
    primaryColor: string;
  };
};

type CurrentUserState = {
  data?: CurrentUser;
  error: string;
  loading: boolean;
};

const CurrentUserContext = createContext<CurrentUserState | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<CurrentUser>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (router.pathname === '/sign-in' || router.pathname === '/setup') {
      setData(undefined);
      setError('');
      setLoading(false);
      return;
    }
    if (router.pathname === '/change-password') return;

    let active = true;
    setLoading(true);
    setError('');
    fetch('/api/v1/me')
      .then(async (response) => {
        if (response.status === 401) {
          location.href = '/sign-in';
          return;
        }
        const body = (await response.json()) as {
          data?: CurrentUser;
          error?: { message?: string };
        };
        if (!response.ok || !body.data) {
          throw new Error(body.error?.message ?? 'Unable to load the current organization.');
        }
        if (active) setData(body.data);
      })
      .catch((requestError: Error) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router.pathname]);

  return (
    <CurrentUserContext.Provider value={{ data, error, loading }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): CurrentUserState {
  const value = useContext(CurrentUserContext);
  if (!value) throw new Error('useCurrentUser must be used within CurrentUserProvider');
  return value;
}
